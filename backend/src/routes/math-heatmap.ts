import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const topics = await prisma.mathTopic.findMany({
    orderBy: { name: 'asc' },
  });

  const attempts = await prisma.mathAttempt.findMany();

  const heatmap = topics.map((topic) => {
    // Collect scores for this topic from both single-topic and mixed attempts
    const scores: number[] = [];

    for (const a of attempts) {
      const breakdown = JSON.parse(a.topicBreakdown) as Record<string, { correct: number; total: number }>;
      const entry = breakdown[topic.slug];
      if (entry && entry.total > 0) {
        scores.push(Math.round((entry.correct / entry.total) * 100));
      }
    }

    const averageScore = scores.length > 0
      ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
      : null;

    return {
      topicId: topic.id,
      topicName: topic.name,
      topicSlug: topic.slug,
      averageScore,
      attemptCount: scores.length,
    };
  });

  res.json(heatmap);
}));

export default router;
