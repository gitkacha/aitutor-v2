import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const topicSlug = req.query.topic as string | undefined;

  let questions;
  if (topicSlug) {
    const topic = await prisma.mathTopic.findUnique({
      where: { slug: topicSlug },
    });
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    questions = await prisma.mathQuestion.findMany({
      where: { topicId: topic.id },
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true },
    });
  } else {
    // All topics — 35 questions mixed
    questions = await prisma.mathQuestion.findMany({
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true },
    });
  }

  // Shuffle questions using Fisher-Yates
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  res.json(shuffled);
});

export default router;