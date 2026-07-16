import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateMathWorksheetQuestions } from '../services/ai.service';
import { createWorksheetQuestionRows, validateWorksheetQuestions } from '../services/math-worksheet.service';

const router = Router();

// POST /api/math/worksheets/generate — AI-generate 35-question worksheet
router.post('/generate', async (req: Request, res: Response) => {
  const { topicIds } = req.body; // Array of topic slugs, empty = all topics
  const questionCount = Math.max(5, Math.min(50, parseInt(req.body.questionCount) || 35));

  let topics;
  if (topicIds && topicIds.length > 0) {
    topics = await prisma.mathTopic.findMany({
      where: { slug: { in: topicIds } },
      include: {
        questions: {
          orderBy: { percentCorrect: 'asc' },
          take: 1, // hardest question per topic for difficulty calibration
        },
      },
    });
  } else {
    topics = await prisma.mathTopic.findMany({
      include: {
        questions: {
          orderBy: { percentCorrect: 'asc' },
          take: 1,
        },
      },
    });
  }

  if (topics.length === 0) {
    return res.status(400).json({ error: 'No topics found' });
  }

  try {
    const generatedQuestions = await generateMathWorksheetQuestions(topics, questionCount);
    res.json({
      topics: topics.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
      questions: generatedQuestions,
    });
  } catch (error: any) {
    console.error('Worksheet generation failed:', error);
    res.status(502).json({ error: error?.message || 'Worksheet generation failed' });
  }
});

// POST /api/math/worksheets/save — save an admin-reviewed worksheet
router.post('/save', async (req: Request, res: Response) => {
  const { title, topicIds, questions } = req.body;

  if (!title || !questions) {
    return res.status(400).json({ error: 'Missing required fields: title, questions' });
  }
  if (!validateWorksheetQuestions(questions)) {
    return res.status(400).json({ error: 'questions must be a non-empty array of {questionText, options[], correctIndex, explanation, topicSlug}' });
  }

  try {
    const worksheet = await prisma.$transaction(async (tx) => {
      const created = await tx.mathWorksheet.create({
        data: {
          title,
          topicIds: JSON.stringify(topicIds || []),
          questions: JSON.stringify(questions),
        },
      });
      await createWorksheetQuestionRows(created.id, questions, tx);
      return created;
    });

    res.status(201).json(worksheet);
  } catch (error: any) {
    if (String(error?.message).startsWith('Unknown topic slug')) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Worksheet save failed:', error);
    res.status(500).json({ error: 'Failed to save worksheet' });
  }
});

// GET /api/math/worksheets — list all worksheets
router.get('/', async (_req: Request, res: Response) => {
  const worksheets = await prisma.mathWorksheet.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      attempts: {
        orderBy: { finishedAt: 'desc' },
      },
    },
  });

  res.json(worksheets);
});

export default router;