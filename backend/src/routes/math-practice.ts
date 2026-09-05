import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { createJob, getJobForWorkspace } from '../lib/generation-jobs';
import { generateSelfPracticeWorksheet } from '../services/math-practice.service';

const router = Router();

// POST /api/math/practice/generate { topicSlug } — on-demand self-serve practice (W-101).
// Thinking Skills sections generate a fresh set each time (Mathematics keeps its bank-based
// practice). Generation runs as a background job so the client can poll for the persisted
// worksheet id, mirroring the admin generate flow.
router.post('/generate', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const topicSlug = String(req.body?.topicSlug || '');
  if (!topicSlug) return res.status(400).json({ error: 'topicSlug is required' });

  // Validate synchronously so a non-Thinking-Skills topic gets a clean 400/404 rather than a
  // background-job error the client only learns about after polling.
  const topic = await prisma.mathTopic.findUnique({ where: { slug: topicSlug } });
  if (!topic) return res.status(404).json({ error: 'Topic not found' });
  if (topic.subject !== 'thinking-skills') {
    return res.status(400).json({ error: 'On-demand practice is only available for Thinking Skills sections' });
  }

  const workspaceId = req.user!.workspaceId;
  const studentId = req.user!.id;
  const jobId = createJob('math', workspaceId, async () =>
    generateSelfPracticeWorksheet({ topicSlug, workspaceId, studentId })
  );
  res.status(202).json({ jobId });
}));

// GET /api/math/practice/jobs/:jobId — poll a practice-generation job, workspace-scoped.
router.get('/jobs/:jobId', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const job = getJobForWorkspace(req.params.jobId, req.user!.workspaceId);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  res.json({ status: job.status, result: job.result, error: job.error });
}));

export default router;
