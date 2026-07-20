import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { getWorksheetQuestionRows } from '../services/math-worksheet.service';
import { asyncHandler } from '../lib/async-handler';
import { selectTestQuestions, MAX_TEST_QUESTIONS } from '../lib/question-select';
import { requireAuth } from '../middleware/auth';

const router = Router();

// A student sits the test in the browser, so anything sent to them is readable in the
// network payload. Strip the answer key and explanation from each question for students;
// scoring is server-side and the post-submission review comes from a separate endpoint.
// Admins keep the full fields — the read-only worksheet-content view relies on them (W-28).
function stripAnswersForStudents<T extends { correctIndex?: unknown; explanation?: unknown }>(
  questions: T[],
  role: string | undefined,
): T[] {
  if (role === 'admin') return questions;
  return questions.map(({ correctIndex, explanation, ...rest }) => rest as T);
}

router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const topicSlug = req.query.topic as string | undefined;
  const worksheetParam = req.query.worksheet as string | undefined;

  // Worksheet mode: serve the worksheet's own persisted questions, in authored order.
  if (worksheetParam) {
    const worksheetId = parseInt(worksheetParam);
    if (isNaN(worksheetId)) {
      return res.status(400).json({ error: 'Invalid worksheet ID' });
    }
    // Access check (B1): the worksheet must be in the caller's workspace, and a
    // student must actually be assigned to it. Out-of-scope looks like missing.
    const user = req.user!;
    const worksheet = await prisma.mathWorksheet.findUnique({
      where: { id: worksheetId },
      include: { assignments: { select: { studentId: true } } },
    });
    if (
      !worksheet ||
      worksheet.workspaceId !== user.workspaceId ||
      (user.role !== 'admin' && !worksheet.assignments.some((a) => a.studentId === user.id))
    ) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    const rows = await getWorksheetQuestionRows(worksheetId);
    if (!rows) {
      return res.status(404).json({ error: 'Worksheet not found' });
    }
    return res.json(stripAnswersForStudents(rows, user.role));
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
  res.json(stripAnswersForStudents(selectTestQuestions(questions, cap), req.user!.role));
}));

export default router;
