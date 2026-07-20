import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { resolveAssigneeStudentIds } from '../lib/scope';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';

const router = Router();

// POST /api/worksheets/generate — generate prompts without saving (preview)
router.post('/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { typeIds } = req.body;

  if (!typeIds || !Array.isArray(typeIds) || typeIds.length === 0) {
    res.status(400).json({ error: 'typeIds array is required', status: 400 });
    return;
  }

  // Background job (W-19) so the admin can navigate away and re-attach.
  const jobId = createJob('writing', req.user!.workspaceId, async () => {
    const prompts = await generateWorksheetPrompts(typeIds);
    const types = await prisma.writingType.findMany({
      where: { id: { in: typeIds } },
      orderBy: { name: 'asc' },
    });
    return { types: types.map((t) => ({ id: t.id, name: t.name, slug: t.slug })), prompts };
  });
  res.status(202).json({ jobId });
}));

// GET /api/worksheets/jobs/:jobId — poll a writing-generation job (W-19), workspace-scoped.
router.get('/jobs/:jobId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const job = getJobForWorkspace(req.params.jobId, req.user!.workspaceId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// POST /api/worksheets/save — save an admin-reviewed worksheet
router.post('/save', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { title, typeIds, prompts, studentIds } = req.body;

  if (!title || !Array.isArray(typeIds) || typeIds.length === 0 || !Array.isArray(prompts)) {
    res.status(400).json({ error: 'Missing required fields: title, typeIds, prompts', status: 400 });
    return;
  }

  // Assignment picker (C1): assign to the chosen students, or every student when omitted.
  const assigneeIds = await resolveAssigneeStudentIds(req, res, studentIds);
  if (!assigneeIds) return;

  try {
    // A writing attempt is always a single text type, so a multi-type selection becomes one
    // worksheet per type (H3). prompts[i] belongs to types[i], both sorted by name — the
    // order /generate returned them in.
    const types = await prisma.writingType.findMany({
      where: { id: { in: typeIds } },
      orderBy: { name: 'asc' },
    });

    // One prompt per resolved type — a mismatch means a bad request, never a silent
    // duplication of prompts[0] (L14).
    if (types.length === 0 || types.length !== prompts.length) {
      res.status(400).json({ error: 'typeIds and prompts must resolve to the same count', status: 400 });
      return;
    }

    const worksheets = await Promise.all(
      types.map(async (type, i) => {
        const promptText = prompts[i];
        const worksheet = await prisma.worksheet.create({
          data: {
            // Tenant scoping (Milestone 2 Phase A): worksheets belong to the creator's
            // workspace; the assignment picker lands in Phase C1.
            workspaceId: req.user!.workspaceId,
            createdById: req.user!.id,
            title: types.length === 1 ? title : `Worksheet: ${type.name}`,
            typeId: type.id,
            prompts: JSON.stringify([promptText]),
          },
        });
        // The worksheet's prompt is a real Prompt row so attempts reference the task the
        // student actually answers and the analysis grades against it (H4).
        await prisma.prompt.create({
          data: { typeId: type.id, text: promptText, source: 'worksheet' },
        });
        // Assign to the admin-selected students (C1).
        if (assigneeIds.length > 0) {
          await prisma.worksheetAssignment.createMany({
            data: assigneeIds.map((studentId) => ({ worksheetId: worksheet.id, studentId })),
          });
        }
        return worksheet;
      })
    );

    res.status(201).json(worksheets);
  } catch (error) {
    console.error('Worksheet save failed:', error);
    res.status(500).json({ error: 'Failed to save worksheet', status: 500 });
  }
}));

// Scoped list (B1): admins see their workspace (with assignments); students see
// only worksheets assigned to them, with only their own attempts included.
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const user = req.user!;
  const worksheets = await prisma.worksheet.findMany({
    where: user.role === 'admin'
      ? { workspaceId: user.workspaceId }
      : { assignments: { some: { studentId: user.id } } },
    orderBy: { createdAt: 'desc' },
    include: {
      assignments: true,
      attempts: {
        where: user.role === 'admin' ? {} : { userId: user.id },
        include: { analysis: true },
      },
    },
  });
  res.json(worksheets);
}));

// GET /api/worksheets/available/:typeId — get worksheets for a specific writing type
router.get('/available/:typeId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const typeId = parseInt(req.params.typeId);
  if (isNaN(typeId)) {
    return res.status(400).json({ error: 'Invalid typeId', status: 400 });
  }

  const user = req.user!;
  const worksheets = await prisma.worksheet.findMany({
    where: {
      typeId,
      ...(user.role === 'admin'
        ? { workspaceId: user.workspaceId }
        : { assignments: { some: { studentId: user.id } } }),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      attempts: {
        where: user.role === 'admin' ? {} : { userId: user.id },
        select: { id: true, source: true, finishedAt: true, isDemo: true },
      },
    },
  });

  // Filter out worksheets where all attempts are demo (or show them? show them)
  res.json(worksheets);
}));

export default router;
