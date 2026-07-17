import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

// POST /api/math/attempts — save a completed attempt
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { topicId, questions, answers, startedAt, finishedAt, timeTaken, source, worksheetId } = req.body;

  if (!questions || !answers || !startedAt || !finishedAt || timeTaken == null) {
    return res.status(400).json({ error: 'Missing required fields: questions, answers, startedAt, finishedAt, timeTaken' });
  }

  // Compute score and topic breakdown; questions/answers are client-supplied JSON strings.
  let questionIds: number[];
  let answerIndices: number[];
  try {
    questionIds = JSON.parse(questions);
    answerIndices = JSON.parse(answers);
    if (!Array.isArray(questionIds) || !Array.isArray(answerIndices)) throw new Error('not arrays');
  } catch {
    return res.status(400).json({ error: 'questions and answers must be valid JSON arrays' });
  }

  // Validate the payload beyond parseability (M10): silent acceptance of malformed data
  // deflates scores and breaks the review page.
  const isIntArray = (arr: unknown[]): boolean => arr.every((v) => Number.isInteger(v));
  if (
    questionIds.length === 0 ||
    questionIds.length !== answerIndices.length ||
    !isIntArray(questionIds) ||
    !isIntArray(answerIndices)
  ) {
    return res.status(400).json({ error: 'questions and answers must be equal-length non-empty integer arrays' });
  }
  if (new Set(questionIds).size !== questionIds.length) {
    return res.status(400).json({ error: 'questions must not contain duplicate ids' });
  }
  if (topicId != null) {
    const topic = await prisma.mathTopic.findUnique({ where: { id: topicId } });
    if (!topic) {
      return res.status(400).json({ error: 'Unknown topicId' });
    }
  }

  const questionRecords = await prisma.mathQuestion.findMany({
    where: { id: { in: questionIds } },
    include: { topic: true },
  });

  if (questionRecords.length !== questionIds.length) {
    return res.status(400).json({ error: 'Unknown question id(s)' });
  }

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
}));

// GET /api/math/attempts — list attempts
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const topicSlug = req.query.topic as string | undefined;

  const where: any = {};
  if (topicSlug) {
    const topic = await prisma.mathTopic.findUnique({
      where: { slug: topicSlug },
    });
    if (!topic) {
      // Same contract as math-questions: an unknown slug is an error, never "everything".
      return res.status(404).json({ error: 'Topic not found' });
    }
    where.topicId = topic.id;
  }

  const attempts = await prisma.mathAttempt.findMany({
    where,
    orderBy: { finishedAt: 'desc' },
    include: { topic: true },
  });

  res.json(attempts);
}));

// GET /api/math/attempts/:id — single attempt with full question details
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
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
}));

export default router;
