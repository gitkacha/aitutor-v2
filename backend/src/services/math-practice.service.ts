import prisma from '../lib/prisma';
import { generateMathWorksheet } from './ai.service';
import { saveAndAssignWorksheet } from './math-worksheet.service';

// Phase A / A2 (W-101): on-demand self-serve practice for Thinking Skills. Unlike Mathematics
// (which draws practice from its seeded bank), a Thinking Skills section generates a fresh set each
// time. The questions must be PERSISTED so the timed attempt and its review can reference real
// question IDs — so we save them as an UNASSIGNED `kind:"self-practice"` worksheet owned by the
// student, hidden from the admin list and from the student's pending/assigned lists.

export const PRACTICE_QUESTION_COUNT = 8;

export async function generateSelfPracticeWorksheet(params: {
  topicSlug: string;
  workspaceId: number;
  studentId: number;
}): Promise<{ worksheetId: number }> {
  const { topicSlug, workspaceId, studentId } = params;

  const topic = await prisma.mathTopic.findUnique({ where: { slug: topicSlug } });
  if (!topic) throw new Error('Topic not found');
  if (topic.subject !== 'thinking-skills') {
    throw new Error('On-demand practice is only available for Thinking Skills sections');
  }

  // The EXACT same generation engine the admin/coach use (subject + option count derived from the
  // resolved topics).
  const result = await generateMathWorksheet([topicSlug], PRACTICE_QUESTION_COUNT, workspaceId);

  const worksheet = await saveAndAssignWorksheet({
    workspaceId,
    createdById: studentId,
    title: `Practice: ${topic.name}`,
    topicIds: [topicSlug],
    questions: result.questions,
    assigneeIds: [],
    kind: 'self-practice',
  });

  return { worksheetId: worksheet.id };
}
