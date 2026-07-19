import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { resolveScopeUserIds } from '../lib/scope';
import { aggregateWritingHeatmap } from '../lib/writing-heatmap-aggregate';

const router = Router();

// Per-student heatmap (B1): students see themselves; admins their workspace aggregate
// or one member via ?studentId=.
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userIds = await resolveScopeUserIds(req, res);
  if (!userIds) return;

  const types = await prisma.writingType.findMany({
    include: {
      attempts: {
        where: { userId: { in: userIds } },
        include: { analysis: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  res.json(aggregateWritingHeatmap(types));
}));

export default router;
