import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';

export interface WorksheetQuestionJson {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName?: string;
}

type Db = PrismaClient | Prisma.TransactionClient;

export function validateWorksheetQuestions(questions: unknown): questions is WorksheetQuestionJson[] {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  return questions.every((q) =>
    q &&
    typeof q.questionText === 'string' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    q.options.every((o: unknown) => typeof o === 'string') &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < q.options.length &&
    typeof q.topicSlug === 'string'
  );
}

// Persist worksheet questions as real MathQuestion rows so attempts are scored,
// stored and reviewed through the same ID-based path as regular practice.
export async function createWorksheetQuestionRows(
  worksheetId: number,
  questions: WorksheetQuestionJson[],
  db: Db = prisma
) {
  const slugs = [...new Set(questions.map((q) => q.topicSlug))];
  const topics = await db.mathTopic.findMany({ where: { slug: { in: slugs } } });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const missing = slugs.filter((s) => !topicBySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown topic slug(s): ${missing.join(', ')}`);
  }

  for (const q of questions) {
    await db.mathQuestion.create({
      data: {
        topicId: topicBySlug.get(q.topicSlug)!,
        worksheetId,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      },
    });
  }
}

// Fetch a worksheet's question rows in authored order, materialising them from the
// stored JSON for worksheets saved before question rows existed.
export async function getWorksheetQuestionRows(worksheetId: number) {
  const worksheet = await prisma.mathWorksheet.findUnique({ where: { id: worksheetId } });
  if (!worksheet) return null;

  const fetchRows = () =>
    prisma.mathQuestion.findMany({
      where: { worksheetId },
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true },
    });

  let rows = await fetchRows();
  if (rows.length === 0) {
    const json = JSON.parse(worksheet.questions || '[]');
    if (validateWorksheetQuestions(json)) {
      await createWorksheetQuestionRows(worksheetId, json);
      rows = await fetchRows();
    }
  }
  return rows;
}
