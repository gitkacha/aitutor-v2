import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { aggregateMathHeatmap } from '../lib/math-heatmap-aggregate';
import { requireAuth } from '../middleware/auth';
import { resolveScopeUserIds } from '../lib/scope';

const router = Router();

// Per-student heatmap (B1) — same scoping contract as the writing heatmap.
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userIds = await resolveScopeUserIds(req, res);
  if (!userIds) return;

  const topics = await prisma.mathTopic.findMany({
    orderBy: { name: 'asc' },
  });

  const attempts = await prisma.mathAttempt.findMany({
    where: { userId: { in: userIds } },
  });

  res.json(aggregateMathHeatmap(topics, attempts));
}));

export default router;
