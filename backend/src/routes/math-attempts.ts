import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// POST /api/math/attempts — save a completed attempt
router.post('/', async (req: Request, res: Response) => {
  const { topicId, questions, answers, startedAt, finishedAt, timeTaken, source, worksheetId } = req.body;

  if (!questions || !answers || !startedAt || !finishedAt || timeTaken == null) {
    return res.status(400).json({ error: 'Missing required fields: questions, answers, startedAt, finishedAt, timeTaken' });
  }

  // Compute score and topic breakdown
  const questionIds: number[] = JSON.parse(questions);
  const answerIndices: number[] = JSON.parse(answers);

  const questionRecords = await prisma.mathQuestion.findMany({
    where: { id: { in: questionIds } },
    include: { topic: true },
  });

  const questionMap = new Map(questionRecords.map(q => [q.id, q]));

  let score = 0;
  const breakdown: Record<string, { correct: number; total: number }> = {};

  for (let i = 0; i < questionIds.length; i++) {
    const q = questionMap.get(questionIds[i]);
    if (!q) continue;

    const topicSlug = q.topic.slug;
    if (!breakdown[topicSlug]) {
      breakdown[topicSlug] = { correct: 0, total: 0 };
    }
    breakdown[topicSlug].total++;

    if (answerIndices[i] === q.correctIndex) {
      score++;
      breakdown[topicSlug].correct++;
    }
  }

  const attempt = await prisma.mathAttempt.create({
    data: {
      topicId: topicId ?? null,
      questions,
      answers,
      topicBreakdown: JSON.stringify(breakdown),
      score,
      totalQuestions: questionIds.length,
      startedAt: new Date(startedAt),
      finishedAt: new Date(finishedAt),
      timeTaken,
      source: source || 'practice',
      worksheetId: worksheetId ?? null,
    },
  });

  res.status(201).json(attempt);
});

// GET /api/math/attempts — list attempts
router.get('/', async (req: Request, res: Response) => {
  const topicSlug = req.query.topic as string | undefined;

  const where: any = {};
  if (topicSlug) {
    const topic = await prisma.mathTopic.findUnique({
      where: { slug: topicSlug },
    });
    if (topic) {
      where.topicId = topic.id;
    }
  }

  const attempts = await prisma.mathAttempt.findMany({
    where,
    orderBy: { finishedAt: 'desc' },
    include: { topic: true },
  });

  res.json(attempts);
});

// GET /api/math/attempts/:id — single attempt with full question details
router.get('/:id', async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid attempt ID' });
  }

  const attempt = await prisma.mathAttempt.findUnique({
    where: { id },
    include: { topic: true, worksheet: true },
  });

  if (!attempt) {
    return res.status(404).json({ error: 'Attempt not found' });
  }

  // Fetch full question details
  const questionIds: number[] = JSON.parse(attempt.questions);
  const questions = await prisma.mathQuestion.findMany({
    where: { id: { in: questionIds } },
    include: { stimulusGroup: true, topic: true },
  });

  // Reorder questions to match the stored order
  const orderedQuestions = questionIds.map(id => questions.find(q => q.id === id)).filter(Boolean);

  res.json({
    ...attempt,
    questionDetails: orderedQuestions,
    answersArray: JSON.parse(attempt.answers),
    breakdown: JSON.parse(attempt.topicBreakdown),
  });
});

export default router;