import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { resolveScopeUserIds } from '../lib/scope';

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

  const heatmap = types.map((type) => {
    const scoredAttempts = type.attempts.filter((a) => a.analysis?.overallScore != null);
    const averageScore =
      scoredAttempts.length > 0
        ? Math.round(
            scoredAttempts.reduce((sum, a) => sum + a.analysis!.overallScore, 0) /
              scoredAttempts.length
          )
        : null;

    return {
      typeId: type.id,
      typeName: type.name,
      typeSlug: type.slug,
      averageScore,
      attemptCount: type.attempts.length,
    };
  });

  res.json(heatmap);
}));

export default router;
