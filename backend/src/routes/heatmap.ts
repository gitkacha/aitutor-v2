import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const types = await prisma.writingType.findMany({
    include: {
      attempts: {
        // Demo data is visible when loaded; isDemo flag exists for clean clearing
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
});

export default router;