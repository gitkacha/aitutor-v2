import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const topics = await prisma.mathTopic.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(topics);
}));

router.get('/:slug', asyncHandler(async (req: Request, res: Response) => {
  const topic = await prisma.mathTopic.findUnique({
    where: { slug: req.params.slug },
    include: {
      questions: {
        // Worksheet-owned questions are not part of the topic's practice bank.
        where: { worksheetId: null },
        orderBy: { id: 'asc' },
        include: { stimulusGroup: true },
      },
    },
  });
  if (!topic) {
    return res.status(404).json({ error: 'Topic not found' });
  }
  res.json(topic);
}));

export default router;
