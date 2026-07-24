import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// M3b Task 9: intervention outcome recompute (spec §6.3). An intervention is created through the
// only path that exists — the chat confirm flow — freezing a diagnosisSnapshot. Then the student
// answers more questions on the targeted skill *after* the intervention, and GET
// /api/interventions/:id/outcome recomputes (never stored) the per-skill before/post accuracy and
// status. With fewer than 8 post-intervention attempted questions the evidence floor holds and the
// status is 'insufficient-evidence'. Assertions check the SHAPE and the gate, not hand-picked
// accuracy numbers.
//
// Fixture follows the analytics W-28 pattern: tag one 'combinations' bank question directly (the
// report adapter isn't under test), source the answer key from an admin request, and have the e2e
// student submit attempts (pre- and post-intervention).

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'combinations';
const SKILL_SLUG = 'systematic-listing';

async function tagQuestion(): Promise<{ questionId: number; correctIndex: number; studentId: number }> {
  const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
  const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
  const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
  await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
  const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
  return { questionId: question.id, correctIndex: -1, studentId: student.id };
}

async function submitAttempt(
  student: APIRequestContext,
  questionId: number,
  answerIndex: number,
  finishedAt: Date,
): Promise<void> {
  const startedAt = new Date(finishedAt.getTime() - 30_000);
  const res = await student.post('/api/math/attempts', {
    data: {
      questions: JSON.stringify([questionId]),
      answers: JSON.stringify([answerIndex]),
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      timeTaken: 30,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
}

test.describe('M3b Task 9 — intervention outcome recompute + evidence gate', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('outcome recomputes per-skill before/post accuracy; <8 post-attempted → insufficient-evidence', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    const { questionId, studentId } = await tagQuestion();

    // Answer key sourced as admin (student payload strips correctIndex).
    const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
    const q = bank.find((row: any) => row.id === questionId);
    const correctIndex: number = q.correctIndex;
    const wrongIndex = (correctIndex + 1) % JSON.parse(q.options).length;

    // Pre-intervention attempts, timestamped in the past so they precede the snapshot: one wrong
    // to give the skill a below-1 baseline accuracy.
    const past = new Date(Date.now() - 10 * 60_000);
    await submitAttempt(student, questionId, wrongIndex, past);
    await submitAttempt(student, questionId, correctIndex, new Date(past.getTime() + 1000));

    // Create the intervention via the chat confirm flow (the only creation path).
    const stub = await startChatStub([
      toolCall('create_intervention', {
        studentId,
        skillSlugs: [SKILL_SLUG],
        recommendation: 'Targeted systematic-listing practice.',
        rationale: 'Baseline accuracy is low on this skill.',
      }),
      narration('Recorded.'),
    ]);
    let interventionId: number;
    try {
      const { id: sessionId } = await (await admin.post('/api/chat/sessions', { data: {} })).json();
      const step = await (await admin.post(`/api/chat/sessions/${sessionId}/messages`, {
        data: { content: 'Create an intervention for E2E Student on combinations.' },
      })).json();
      expect(step.pendingAction).toBeTruthy();
      await admin.post(`/api/chat/sessions/${sessionId}/confirm`, {
        data: { actionId: step.pendingAction.id, approve: true },
      });

      const list = await (await admin.get(`/api/interventions?studentId=${studentId}`)).json();
      const created = list.find((iv: any) => iv.chatSessionId === sessionId);
      expect(created, 'the intervention was created and linked to its session').toBeTruthy();
      interventionId = created.id;
    } finally {
      await new Promise((r) => stub.close(r));
    }

    // Post-intervention attempts (finishedAt now, strictly after the snapshot): correct answers
    // raising the skill's accuracy, but only 3 — under the evidence floor of 8.
    for (let i = 0; i < 3; i++) {
      await submitAttempt(student, questionId, correctIndex, new Date());
    }

    const outcomeRes = await admin.get(`/api/interventions/${interventionId}/outcome`);
    expect(outcomeRes.status()).toBe(200);
    const outcome = await outcomeRes.json();

    const perSkill = outcome.perSkill.find((p: any) => p.slug === SKILL_SLUG);
    expect(perSkill, 'the targeted skill appears in the outcome').toBeTruthy();
    expect(typeof perSkill.before).toBe('number');
    expect(typeof perSkill.postAccuracy).toBe('number');
    expect(perSkill.postAttempted).toBe(3);
    // Evidence gate: fewer than 8 post-attempted questions → insufficient-evidence, regardless of
    // how much accuracy rose.
    expect(perSkill.postAttempted).toBeLessThan(8);
    expect(perSkill.status).toBe('insufficient-evidence');
    expect(outcome.status).toBe('insufficient-evidence');

    await admin.dispose();
    await student.dispose();
  });

  test('outcome for a foreign / unknown intervention id is 404', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    try {
      const res = await admin.get('/api/interventions/99999999/outcome');
      expect(res.status()).toBe(404);
    } finally {
      await admin.dispose();
    }
  });
});
