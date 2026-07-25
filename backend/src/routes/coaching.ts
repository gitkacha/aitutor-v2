import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';
import { generateCoachingModuleContent } from '../services/coaching.service';

// M3c Phase 2 (W-64): coaching modules. Generation runs as a background job (like worksheet
// generation) so the admin can navigate away and re-attach. Approved-only visibility is enforced
// here: a student requesting a draft gets 404, never 403 — its existence is not revealed (§8.2/§0.6).
const router = Router();

// POST /api/coaching/modules/generate { skillId } — generate → verify (one retry) → save draft.
router.post('/modules/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const skillId = Number(req.body?.skillId);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, subject: 'math' } });
  if (!skill) return res.status(400).json({ error: 'Math skill not found' });

  const jobId = createJob('math', req.user!.workspaceId, async () => {
    const gen = await generateCoachingModuleContent({
      name: skill.name,
      slug: skill.slug,
      examLevelNotes: skill.examLevelNotes,
    });
    const mod = await prisma.coachingModule.create({
      data: {
        workspaceId: req.user!.workspaceId,
        skillId: skill.id,
        title: gen.title,
        content: gen.content,
        status: 'draft',
      },
    });
    return { moduleId: mod.id, verifierWarnings: gen.verifierWarnings };
  });
  res.status(202).json({ jobId });
}));

// GET /api/coaching/jobs/:jobId — poll a generation job (workspace-scoped → 404 otherwise).
router.get('/jobs/:jobId', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const job = getJobForWorkspace(req.params.jobId, req.user!.workspaceId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

// GET /api/coaching/modules?skillId= — admin list of a skill's modules (draft + approved).
router.get('/modules', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const skillId = req.query.skillId != null ? Number(req.query.skillId) : undefined;
  const modules = await prisma.coachingModule.findMany({
    where: { workspaceId: req.user!.workspaceId, ...(skillId ? { skillId } : {}) },
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(modules);
}));

// GET /api/coaching/modules/:id — admins get any in their workspace; students only if approved.
router.get('/modules/:id', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  // Approved-only visibility for non-admins — never reveal a draft's existence.
  if (req.user!.role !== 'admin' && mod.status !== 'approved') {
    return res.status(404).json({ error: 'Module not found' });
  }
  res.json(mod);
}));

// PATCH /api/coaching/modules/:id { title?, content? } — edit; editing an approved module bumps version.
router.patch('/modules/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const data: { title?: string; content?: string; version?: number } = {};
  if (typeof req.body?.title === 'string') data.title = req.body.title;
  if (typeof req.body?.content === 'string') data.content = req.body.content;
  if (mod.status === 'approved') data.version = mod.version + 1;

  const updated = await prisma.coachingModule.update({
    where: { id: mod.id },
    data,
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  res.json(updated);
}));

// POST /api/coaching/modules/:id/approve — mark approved (assignable + visible to students).
router.post('/modules/:id/approve', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  const approved = await prisma.coachingModule.update({
    where: { id: mod.id },
    data: { status: 'approved', reviewedById: req.user!.id },
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  res.json(approved);
}));

export default router;
