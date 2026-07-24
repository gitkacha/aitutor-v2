import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// M3b Task 9: the admin coach-chat API proves the whole grounded tool loop end-to-end with a
// scripted OpenAI stub on :3106 (see helpers/chat-stub). Three things are under test:
//   1. a grounded read: a get_student_skill_report tool call is executed, its result stored as a
//      tool message, the model's narration stored as an assistant message, and ≥3 grounded
//      follow-up chips are returned;
//   2. confirmation gating + snapshot freeze: a create_intervention action is parked (no row is
//      written) until /confirm, and confirming freezes a diagnosisSnapshot linked to the session;
//   3. auth: a student is denied on the chat surface (403).
//
// Fixture: bank questions aren't skill-tagged by default, and get_student_skill_report needs
// tagged attempts to have anything to report — so we tag one 'probability' bank question directly
// (the report adapter is not what's under test here) and have the e2e student attempt it, sourcing
// the answer key from an admin request (the student payload strips correctIndex — W-28 pattern).

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'probability';
const SKILL_SLUG = 'probability-as-fraction';

// Tag one probability question and have the e2e student attempt it `count` times, returning the
// ids the tests need. Idempotent tagging so it's safe to call from more than one test.
async function seedTaggedAttempts(
  admin: APIRequestContext,
  student: APIRequestContext,
  count: number,
): Promise<{ studentId: number; questionId: number }> {
  const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
  const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
  const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
  await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });

  const student_ = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

  // Answer key sourced as admin (the student-facing bank strips correctIndex).
  const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
  const q = bank.find((row: any) => row.id === question.id);
  const correctIndex: number = q.correctIndex;

  for (let i = 0; i < count; i++) {
    const finishedAt = new Date();
    const startedAt = new Date(finishedAt.getTime() - 30_000);
    const res = await student.post('/api/math/attempts', {
      data: {
        questions: JSON.stringify([question.id]),
        answers: JSON.stringify([correctIndex]),
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        timeTaken: 30,
        source: 'practice',
      },
    });
    expect(res.status()).toBe(201);
  }

  return { studentId: student_.id, questionId: question.id };
}

test.describe('M3b Task 9 — coach chat API (grounded loop, gating, auth)', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('grounded read: tool result + narration are stored and follow-up chips returned', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    const { studentId } = await seedTaggedAttempts(admin, student, 2);

    // Script: the model first calls get_student_skill_report, then narrates a grounded answer.
    const stub = await startChatStub([
      toolCall('get_student_skill_report', { studentId, subject: 'math' }),
      narration(`Based on the report, this student has attempted the ${SKILL_SLUG} skill; there is not yet enough data to judge it.`),
    ]);
    try {
      const created = await admin.post('/api/chat/sessions', { data: {} });
      expect(created.status()).toBe(201);
      const { id: sessionId } = await created.json();

      const step = await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
        data: { content: 'How is E2E Student doing in math?' },
      });
      expect(step.status()).toBe(200);
      const result = await step.json();

      // A tool message whose stored result is the skill report (grounded read executed).
      const toolMsg = result.messages.find(
        (m: any) => m.role === 'tool' && m.content.includes('get_student_skill_report'),
      );
      expect(toolMsg, 'a get_student_skill_report tool result must be stored').toBeTruthy();
      const stored = JSON.parse(toolMsg.content);
      expect(stored.toolName).toBe('get_student_skill_report');
      expect(Array.isArray(stored.result.skills), 'the stored tool result carries the report').toBe(true);
      expect(stored.result.skills.some((s: any) => s.slug === SKILL_SLUG)).toBe(true);

      // A plain assistant narration (not a tool-call turn, which is stored as __assistantToolCalls JSON).
      const assistantMsg = result.messages.find(
        (m: any) => m.role === 'assistant' && !m.content.includes('__assistantToolCalls'),
      );
      expect(assistantMsg, 'the assistant narration must be stored').toBeTruthy();
      expect(assistantMsg.content.length).toBeGreaterThan(0);

      // Grounded follow-up chips, always at least 3.
      expect(Array.isArray(result.suggestedQuestions)).toBe(true);
      expect(result.suggestedQuestions.length).toBeGreaterThanOrEqual(3);
    } finally {
      await new Promise((r) => stub.close(r));
      await admin.dispose();
      await student.dispose();
    }
  });

  test('confirmation gating: create_intervention is parked, no row written until confirm; snapshot frozen + linked', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    const { studentId } = await seedTaggedAttempts(admin, student, 2);

    const before = await (await admin.get(`/api/interventions?studentId=${studentId}`)).json();
    const beforeCount = before.length;

    const stub = await startChatStub([
      toolCall('create_intervention', {
        studentId,
        skillSlugs: [SKILL_SLUG],
        recommendation: 'Practise probability-as-fraction with a targeted worksheet.',
        rationale: 'Early data suggests this skill needs reinforcement.',
      }),
      narration('Done — I have recorded the intervention.'),
    ]);
    try {
      const { id: sessionId } = await (await admin.post('/api/chat/sessions', { data: {} })).json();

      const step = await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
        data: { content: 'Create an intervention for E2E Student on probability.' },
      });
      expect(step.status()).toBe(200);
      const result = await step.json();

      // The action is proposed, not executed.
      expect(result.pendingAction, 'the action must be parked for confirmation').toBeTruthy();
      expect(result.pendingAction.toolName).toBe('create_intervention');

      // No Intervention row exists yet — gating holds.
      const mid = await (await admin.get(`/api/interventions?studentId=${studentId}`)).json();
      expect(mid.length, 'no intervention is written before confirmation').toBe(beforeCount);

      // Confirm → the action executes and a row is written.
      const confirm = await admin.post(`/api/chat/sessions/${sessionId}/confirm`, {
        data: { actionId: result.pendingAction.id, approve: true },
      });
      expect(confirm.status()).toBe(200);

      const after = await (await admin.get(`/api/interventions?studentId=${studentId}`)).json();
      expect(after.length, 'confirming writes exactly one intervention').toBe(beforeCount + 1);

      const created = after.find((iv: any) => iv.chatSessionId === sessionId);
      expect(created, 'the intervention is linked to its chat session (Part A threading)').toBeTruthy();

      // The diagnosis snapshot is frozen server-side and carries the targeted skill's signal.
      const snapshot = JSON.parse(created.diagnosisSnapshot);
      expect(snapshot.capturedAt).toBeTruthy();
      expect(Array.isArray(snapshot.skills)).toBe(true);
      expect(snapshot.skills.some((s: any) => s.slug === SKILL_SLUG), 'the frozen snapshot captures the targeted skill').toBe(true);
    } finally {
      await new Promise((r) => stub.close(r));
      await admin.dispose();
      await student.dispose();
    }
  });

  test('auth: a student is denied on the chat surface (403)', async ({ baseURL }) => {
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    try {
      const res = await student.post('/api/chat/sessions', { data: {} });
      expect(res.status()).toBe(403);
    } finally {
      await student.dispose();
    }
  });
});
