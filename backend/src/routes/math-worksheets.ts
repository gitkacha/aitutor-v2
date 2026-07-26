import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateMathWorksheetQuestions, resolveMathTopicsForGeneration } from '../services/ai.service';
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
  const questionCount = Math.max(5, Math.min(50, parseInt(req.body.questionCount) || 35));

  const topics = await resolveMathTopicsForGeneration(topicIds);

  if (topics.length === 0) {
    return res.status(400).json({ error: 'No topics found' });
  }

  // Run generation as a background job (W-19) so the admin can navigate away and re-attach.
  const topicSummaries = topics.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
  const jobId = createJob('math', req.user!.workspaceId, async () => ({
    topics: topicSummaries,
    questions: await generateMathWorksheetQuestions(topics, questionCount),
  }));
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
  const enriched = worksheets.map((w) => ({ ...w, interventionId: ivMap.get(w.id) ?? null }));

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

export default router;
