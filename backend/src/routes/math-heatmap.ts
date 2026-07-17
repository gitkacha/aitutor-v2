import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { aggregateMathHeatmap } from '../lib/math-heatmap-aggregate';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const topics = await prisma.mathTopic.findMany({
    orderBy: { name: 'asc' },
  });

  const attempts = await prisma.mathAttempt.findMany();

  res.json(aggregateMathHeatmap(topics, attempts));
}));

export default router;
