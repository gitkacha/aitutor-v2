import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateMathWorksheetQuestions } from '../services/ai.service';
import { createWorksheetQuestionRows, validateWorksheetQuestions } from '../services/math-worksheet.service';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { resolveAssigneeStudentIds } from '../lib/scope';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';

const router = Router();

// POST /api/math/worksheets/generate — AI-generate 35-question worksheet
router.post('/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { topicIds } = req.body; // Array of topic slugs, empty = all topics
  const questionCount = Math.max(5, Math.min(50, parseInt(req.body.questionCount) || 35));

  let topics;
  if (topicIds && topicIds.length > 0) {
    topics = await prisma.mathTopic.findMany({
      where: { slug: { in: topicIds } },
      include: {
        questions: {
          orderBy: { percentCorrect: 'asc' },
          take: 1, // hardest question per topic for difficulty calibration
        },
      },
    });
  } else {
    topics = await prisma.mathTopic.findMany({
      include: {
        questions: {
          orderBy: { percentCorrect: 'asc' },
          take: 1,
        },
      },
    });
  }

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
    return res.status(400).json({ error: 'questions must be a non-empty array of {questionText, options[], correctIndex, explanation, topicSlug}' });
  }

  // Assignment picker (C1): assign to the chosen students, or every student when omitted.
  const assigneeIds = await resolveAssigneeStudentIds(req, res, studentIds);
  if (!assigneeIds) return;

  try {
    const worksheet = await prisma.$transaction(async (tx) => {
      const created = await tx.mathWorksheet.create({
        data: {
          // Tenant scoping (Milestone 2 Phase A); assignment picker lands in C1.
          workspaceId: req.user!.workspaceId,
          createdById: req.user!.id,
          title,
          topicIds: JSON.stringify(topicIds || []),
          questions: JSON.stringify(questions),
        },
      });
      await createWorksheetQuestionRows(created.id, questions, tx);
      // Assign to the admin-selected students (C1).
      if (assigneeIds.length > 0) {
        await tx.mathWorksheetAssignment.createMany({
          data: assigneeIds.map((studentId) => ({ worksheetId: created.id, studentId })),
        });
      }
      return created;
    });

    res.status(201).json(worksheet);
  } catch (error: any) {
    if (String(error?.message).startsWith('Unknown topic slug')) {
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

  res.json(worksheets);
}));

export default router;
