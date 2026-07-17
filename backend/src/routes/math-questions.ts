import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getWorksheetQuestionRows } from '../services/math-worksheet.service';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const topicSlug = req.query.topic as string | undefined;
  const worksheetParam = req.query.worksheet as string | undefined;

  // Worksheet mode: serve the worksheet's own persisted questions, in authored order.
  if (worksheetParam) {
    const worksheetId = parseInt(worksheetParam);
    if (isNaN(worksheetId)) {
      return res.status(400).json({ error: 'Invalid worksheet ID' });
    }
    const rows = await getWorksheetQuestionRows(worksheetId);
    if (!rows) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    return res.json(rows);
  }

  let questions;
  if (topicSlug) {
    const topic = await prisma.mathTopic.findUnique({
      where: { slug: topicSlug },
    });
    if (!topic) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    questions = await prisma.mathQuestion.findMany({
      where: { topicId: topic.id, worksheetId: null },
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true },
    });
  } else {
    // All topics — 35 questions mixed
    questions = await prisma.mathQuestion.findMany({
      where: { worksheetId: null },
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
}));

export default router;
