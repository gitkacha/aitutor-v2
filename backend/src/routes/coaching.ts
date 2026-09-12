import { Router, Request, Response } from 'express';
import path from 'path';
import multer from 'multer';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';
import { generateCoachingModuleContent } from '../services/coaching.service';
import { generateAnimationSvg } from '../services/coaching-animation.service';
import { normalizeEmbed } from '../lib/media-embed';
import { MEDIA_DIR } from '../lib/media-storage';

// The "Building Block" section text is the concept an AI animation should illustrate (W-128).
function buildingBlockConcept(content: string): string {
  const parts = content.split(/^##\s+/m).slice(1);
  const bodyOf = (block: string) => block.slice(block.indexOf('\n') + 1).trim().slice(0, 800);
  const bb = parts.find((b) => /building block|mental model/i.test(b.slice(0, b.indexOf('\n'))));
  if (bb) return bodyOf(bb);
  if (parts[1]) return bodyOf(parts[1]);
  return content.slice(0, 800);
}

// W-126: uploaded lesson media — video files only, ≤100 MB, stored on local disk.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
    filename: (req, file, cb) => cb(null, `mod${req.params.id}-${Date.now()}${path.extname(file.originalname) || '.mp4'}`),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('video/')),
});

// M3c Phase 2 (W-64): coaching modules. Generation runs as a background job (like worksheet
// generation) so the admin can navigate away and re-attach. Approved-only visibility is enforced
// here: a student requesting a draft gets 404, never 403 — its existence is not revealed (§8.2/§0.6).
const router = Router();

// POST /api/coaching/modules/generate { skillId } — generate → verify (one retry) → save draft.
router.post('/modules/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const skillId = Number(req.body?.skillId);
  // Coaching lessons exist for the MCQ subjects (math + thinking-skills), not writing (W-111).
  const skill = await prisma.skill.findFirst({ where: { id: skillId, subject: { in: ['math', 'thinking-skills'] } } });
  if (!skill) return res.status(400).json({ error: 'Skill not found' });

  const jobId = createJob('math', req.user!.workspaceId, async () => {
    const gen = await generateCoachingModuleContent({
      name: skill.name,
      slug: skill.slug,
      examLevelNotes: skill.examLevelNotes,
    }, skill.subject === 'thinking-skills' ? 'thinking-skills' : 'math');
    const mod = await prisma.coachingModule.create({
      data: {
        workspaceId: req.user!.workspaceId,
        skillId: skill.id,
        title: gen.title,
        content: gen.content,
        status: 'draft',
        // The Standard/Tactical A/B was collapsed to one style; the column is retained (W-123).
        approach: 'tactical',
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

// GET /api/coaching/modules — list modules for the workspace.
//  - admins see all (draft + approved); `?skillId=` filters to a skill, `?approved=1` to approved.
//  - students ALWAYS see approved only (§8.2) — the flag is implied and drafts never leak.
router.get('/modules', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const skillId = req.query.skillId != null ? Number(req.query.skillId) : undefined;
  const approvedOnly = req.user!.role !== 'admin' || req.query.approved === '1';
  const modules = await prisma.coachingModule.findMany({
    where: {
      workspaceId: req.user!.workspaceId,
      ...(skillId ? { skillId } : {}),
      ...(approvedOnly ? { status: 'approved' } : {}),
    },
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

// PATCH /api/coaching/modules/:id/media { kind, url? } — set the Building-Block media (W-126).
//  - kind 'embed' → normalise to a YouTube/Vimeo embed URL (400 on unsupported links).
//  - kind 'none'  → clear it.
router.patch('/modules/:id/media', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const kind = req.body?.kind;
  let data: { mediaKind: string; mediaUrl: string | null };
  if (kind === 'none') {
    data = { mediaKind: 'none', mediaUrl: null };
  } else if (kind === 'embed') {
    const embed = normalizeEmbed(String(req.body?.url ?? ''));
    if (!embed) return res.status(400).json({ error: 'Enter a valid YouTube or Vimeo link.' });
    data = { mediaKind: 'embed', mediaUrl: embed };
  } else {
    return res.status(400).json({ error: 'Unsupported media kind' });
  }

  const updated = await prisma.coachingModule.update({
    where: { id: mod.id },
    data,
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  res.json(updated);
}));

// POST /api/coaching/modules/:id/media/upload (multipart `file`) — attach an uploaded video (W-126).
router.post('/modules/:id/media/upload', requireAdmin, upload.single('file'), asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  if (!req.file) return res.status(400).json({ error: 'Upload a video file.' });

  const updated = await prisma.coachingModule.update({
    where: { id: mod.id },
    data: { mediaKind: 'upload', mediaUrl: `/api/media/${req.file.filename}` },
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  res.json(updated);
}));

// POST /api/coaching/modules/:id/media/animation/generate — AI-generate a safe animated SVG for the
// Building-Block card (background job; W-128).
router.post('/modules/:id/media/animation/generate', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
    include: { skill: { select: { name: true } } },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });

  const jobId = createJob('math', req.user!.workspaceId, async () => {
    const svg = await generateAnimationSvg(mod.skill.name, buildingBlockConcept(mod.content));
    await prisma.coachingModule.update({
      where: { id: mod.id },
      data: { mediaKind: 'animation', mediaSvg: svg, mediaUrl: null },
    });
    return { ok: true };
  });
  res.status(202).json({ jobId });
}));

// GET /api/coaching/assignments/me — the caller's lesson assignments (approved modules only), for
// the pending "learn → practise" list. Includes completion + the intervention that paired it (W-74).
router.get('/assignments/me', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const assignments = await prisma.coachingAssignment.findMany({
    where: { studentId: req.user!.id, module: { workspaceId: req.user!.workspaceId, status: 'approved' } },
    include: { module: { select: { id: true, title: true, skillId: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(
    assignments.map((a) => ({
      id: a.id,
      moduleId: a.moduleId,
      title: a.module.title,
      skillId: a.module.skillId,
      status: a.module.status,
      completedAt: a.completedAt,
      interventionId: a.interventionId,
    })),
  );
}));

// POST /api/coaching/modules/:id/complete — student marks a lesson complete. Lazily creates the
// assignment (interventionId null) if the student reached the lesson self-serve, so completion
// always has a home and admins can see engagement (§4.1/§4.3). 404 if the module isn't approved.
router.post('/modules/:id/complete', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod || mod.status !== 'approved') return res.status(404).json({ error: 'Module not found' });
  const assignment = await prisma.coachingAssignment.upsert({
    where: { moduleId_studentId: { moduleId: mod.id, studentId: req.user!.id } },
    update: { completedAt: new Date() },
    create: { moduleId: mod.id, studentId: req.user!.id, completedAt: new Date() },
  });
  res.json({ completedAt: assignment.completedAt });
}));

export default router;
