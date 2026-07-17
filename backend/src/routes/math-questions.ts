import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getWorksheetQuestionRows } from '../services/math-worksheet.service';
import { asyncHandler } from '../lib/async-handler';
import { selectTestQuestions, MAX_TEST_QUESTIONS } from '../lib/question-select';

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
  let cap: number | null;
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
    cap = null; // single-topic practice uses the topic's full bank
  } else {
    questions = await prisma.mathQuestion.findMany({
      where: { worksheetId: null },
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true },
    });
    cap = MAX_TEST_QUESTIONS; // "All Topics" is a 35-question mixed test
  }

  // Shuffled with stimulus groups kept whole and adjacent (M2).
  res.json(selectTestQuestions(questions, cap));
}));

export default router;
