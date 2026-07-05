import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateMathWorksheetQuestions } from '../services/ai.service';

const router = Router();

// POST /api/math/worksheets/generate — AI-generate 35-question worksheet
router.post('/generate', async (req: Request, res: Response) => {
  const { topicIds } = req.body; // Array of topic slugs, empty = all topics

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

  const generatedQuestions = await generateMathWorksheetQuestions(topics);

  res.json({
    topics: topics.map(t => ({ id: t.id, name: t.name, slug: t.slug })),
    questions: generatedQuestions,
  });
});

// POST /api/math/worksheets/save — save an admin-reviewed worksheet
router.post('/save', async (req: Request, res: Response) => {
  const { title, topicIds, questions } = req.body;

  if (!title || !questions) {
    return res.status(400).json({ error: 'Missing required fields: title, questions' });
  }

  const worksheet = await prisma.mathWorksheet.create({
    data: {
      title,
      topicIds: JSON.stringify(topicIds || []),
      questions: JSON.stringify(questions),
    },
  });

  res.status(201).json(worksheet);
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