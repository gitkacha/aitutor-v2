import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';

const router = Router();

// The topic-detail payload reaches a student's browser (the pre-test page), so its questions
// must not carry the answer key. Strip correctIndex/explanation from each question for students;
// admins keep the full fields. Mirrors the in-test payload guard (W-28/W-29).
function stripAnswersForStudents<T extends { correctIndex?: unknown; explanation?: unknown }>(
  questions: T[],
  role: string | undefined,
): T[] {
  if (role === 'admin') return questions;
  return questions.map(({ correctIndex, explanation, ...rest }) => rest as T);
}

router.get('/', requireAuth, asyncHandler(async (_req: Request, res: Response) => {
  const topics = await prisma.mathTopic.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(topics);
}));

router.get('/:slug', requireAuth, asyncHandler(async (req: Request, res: Response) => {
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
  res.json({ ...topic, questions: stripAnswersForStudents(topic.questions, req.user?.role) });
}));

export default router;
