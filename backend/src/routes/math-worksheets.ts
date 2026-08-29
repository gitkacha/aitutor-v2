import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { resolveMathTopicsForGeneration, generateMathWorksheet } from '../services/ai.service';
import { validateWorksheetQuestions, saveAndAssignWorksheet } from '../services/math-worksheet.service';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { resolveAssigneeStudentIds } from '../lib/scope';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';
import { buildWorksheetInterventionMap } from '../lib/intervention-worksheets';
import { deleteWorksheetIfUnattempted } from '../services/worksheet-delete';

const router = Router();

// The worksheet list reaches a student's browser (pending/assigned lists), and each row's
// `questions` JSON blob carries the answer key. Rewrite that blob for students with
// correctIndex/explanation removed from every question (count preserved for the UI); admins
// keep the full blob. Completes the answer-leak sweep (W-28/W-29/W-30).
function stripWorksheetAnswersForStudents<T extends { questions: string }>(
  worksheets: T[],
  role: string | undefined,
): T[] {
  if (role === 'admin') return worksheets;
  return worksheets.map((ws) => {
    let questions: unknown;
    try {
      questions = JSON.parse(ws.questions || '[]');
    } catch {
      return { ...ws, questions: '[]' };
    }
    const stripped = Array.isArray(questions)
      ? questions.map((q) => {
          if (q && typeof q === 'object') {
            const { correctIndex, explanation, ...rest } = q as Record<string, unknown>;
            return rest;
          }
          return q;
        })
      : questions;
    return { ...ws, questions: JSON.stringify(stripped) };
  });
}

// POST /api/math/worksheets/generate — AI-generate 35-question worksheet
router.post('/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { topicIds } = req.body; // Array of topic slugs, empty = all topics

  // Validate the selection synchronously so an empty/invalid one still 400s (unchanged contract).
  const topics = await resolveMathTopicsForGeneration(topicIds);
  if (topics.length === 0) {
    return res.status(400).json({ error: 'No topics found' });
  }

  // Run generation as a background job (W-19) so the admin can navigate away and re-attach. The job
  // uses the shared generateMathWorksheet — the EXACT same generation the coach chat uses (W-86).
  const workspaceId = req.user!.workspaceId;
  const jobId = createJob('math', workspaceId, async () => {
    const result = await generateMathWorksheet(topicIds, req.body.questionCount, workspaceId);
    return { topics: result.topics, questions: result.questions };
  });
  res.status(202).json({ jobId });
}));

// GET /api/math/worksheets/jobs/:jobId — poll a generation job (W-19), workspace-scoped.
router.get('/jobs/:jobId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const job = getJobForWorkspace(req.params.jobId, req.user!.workspaceId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// POST /api/math/worksheets/save — save an admin-reviewed worksheet
router.post('/save', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { title, topicIds, questions, studentIds } = req.body;

  if (!title || !questions) {
    return res.status(400).json({ error: 'Missing required fields: title, questions' });
  }
  if (!validateWorksheetQuestions(questions)) {
    return res.status(400).json({ error: 'questions must be a non-empty array of {questionText, options[], correctIndex, explanation, topicSlug, skillSlug}' });
  }

  // Assignment picker (C1): assign to the chosen students, or every student when omitted.
  const assigneeIds = await resolveAssigneeStudentIds(req, res, studentIds);
  if (!assigneeIds) return;

  try {
    const worksheet = await saveAndAssignWorksheet({
      workspaceId: req.user!.workspaceId,
      createdById: req.user!.id,
      title,
      topicIds,
      questions,
      assigneeIds,
    });

    res.status(201).json(worksheet);
  } catch (error: any) {
    const msg = String(error?.message);
    if (msg.startsWith('Unknown topic slug')) {
      return res.status(400).json({ error: error.message });
    }
    if (msg.startsWith('Unknown skill slug') || msg.includes('does not belong')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Worksheet save failed:', error);
    res.status(500).json({ error: 'Failed to save worksheet' });
  }
}));

// GET /api/math/worksheets — scoped list (B1): admins see their workspace (with
// assignments); students see only worksheets assigned to them, with only their own
// attempts included.
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const worksheets = await prisma.mathWorksheet.findMany({
    where: user.role === 'admin'
      ? { workspaceId: user.workspaceId }
      : { assignments: { some: { studentId: user.id } } },
    orderBy: { createdAt: 'desc' },
    include: {
      assignments: true,
      attempts: {
        where: user.role === 'admin' ? {} : { userId: user.id },
        orderBy: { finishedAt: 'desc' },
      },
    },
  });

  // Stamp each worksheet with the intervention that paired it (W-74), so the pending list can flag
  // the specific worksheet whose paired lesson is still incomplete.
  const interventions = await prisma.intervention.findMany({
    where: user.role === 'admin' ? { workspaceId: user.workspaceId } : { studentId: user.id },
    select: { id: true, worksheetIds: true },
  });
  const ivMap = buildWorksheetInterventionMap(interventions, 'math');

  // W-99: stamp each worksheet with its subject (derived from its topics) so the UI can label
  // Thinking Skills worksheets correctly rather than calling everything "Mathematics".
  const tsTopics = await prisma.mathTopic.findMany({ where: { subject: 'thinking-skills' }, select: { slug: true } });
  const tsSlugs = new Set(tsTopics.map((t) => t.slug));
  const subjectOf = (topicIdsJson: string) => {
    let slugs: unknown = [];
    try { slugs = JSON.parse(topicIdsJson); } catch { slugs = []; }
    return Array.isArray(slugs) && slugs.some((s) => tsSlugs.has(String(s))) ? 'thinking-skills' : 'math';
  };
  const enriched = worksheets.map((w) => ({ ...w, interventionId: ivMap.get(w.id) ?? null, subject: subjectOf(w.topicIds) }));

  res.json(stripWorksheetAnswersForStudents(enriched, user.role));
}));

// DELETE /api/math/worksheets/:id — admins may delete a worksheet only if it has NO attempts, so
// deletion can never orphan an attempt (W-83). Assignments + persisted question rows cascade away.
router.delete('/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid worksheet id' });
  const result = await deleteWorksheetIfUnattempted('math', id, req.user!.workspaceId);
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  res.json({ deleted: true });
}));

// POST /api/math/worksheets/:id/assign { studentIds } — assign an already-saved worksheet to one or
// more students (W-85). Idempotent (skipDuplicates on the @@unique); only workspace students count.
router.post('/:id/assign', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid worksheet id' });
  const ws = await prisma.mathWorksheet.findFirst({ where: { id, workspaceId: req.user!.workspaceId } });
  if (!ws) return res.status(404).json({ error: 'Worksheet not found' });
  const ids: number[] = Array.isArray(req.body?.studentIds) ? req.body.studentIds.map(Number).filter(Number.isInteger) : [];
  const students = await prisma.user.findMany({
    where: { id: { in: ids }, workspaceId: req.user!.workspaceId, role: 'student' },
    select: { id: true },
  });
  // Idempotent: only create assignments that don't already exist (SQLite has no skipDuplicates).
  const existing = await prisma.mathWorksheetAssignment.findMany({
    where: { worksheetId: id, studentId: { in: students.map((s) => s.id) } },
    select: { studentId: true },
  });
  const already = new Set(existing.map((e) => e.studentId));
  await prisma.mathWorksheetAssignment.createMany({
    data: students.filter((s) => !already.has(s.id)).map((s) => ({ worksheetId: id, studentId: s.id })),
  });
  res.json({ assigned: students.length });
}));

export default router;
