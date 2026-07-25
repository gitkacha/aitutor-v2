import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// M3b-2 Task 2 (W-52): the per-skill accuracy trend endpoint. Tag one bank question (the report
// adapter isn't under test), have the e2e student answer it wrong then right on two dated attempts,
// and assert GET /api/analytics/students/:id/skills/:slug/trend returns two ascending points with
// accuracy 0 then 1. Answer key sourced from an admin request (W-28 pattern). Student → 403.

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

// A topic/skill no other e2e spec tags (m3a-analytics=magic-squares, m3b-chat=probability,
// m3b-interventions=combinations), so this spec's tagged question and attempts don't collide.
const TOPIC_SLUG = 'rotation';
const SKILL_SLUG = 'rotational-symmetry';

async function submitAttempt(student: APIRequestContext, questionId: number, answerIndex: number, finishedAt: Date): Promise<number> {
  const res = await student.post('/api/math/attempts', {
    data: {
      questions: JSON.stringify([questionId]),
      answers: JSON.stringify([answerIndex]),
      startedAt: new Date(finishedAt.getTime() - 30_000).toISOString(),
      finishedAt: finishedAt.toISOString(),
      timeTaken: 30,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id as number;
}

test.describe('M3b-2 Task 2 — per-skill trend endpoint', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('two dated attempts on a skill → two ascending trend points (0 then 1); student denied', async ({ baseURL }) => {
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
    const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
    const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
    await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    // Answer key from the admin view (student payload strips it — W-28).
    const adminQs = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
    const correctIndex: number = adminQs.find((q: any) => q.id === question.id).correctIndex;
    const wrongIndex = (correctIndex + 1) % 5;

    const wrongAttemptId = await submitAttempt(studentCtx, question.id, wrongIndex, new Date('2026-07-10T00:00:00.000Z')); // 0%
    const rightAttemptId = await submitAttempt(studentCtx, question.id, correctIndex, new Date('2026-07-11T00:00:00.000Z')); // 100%

    // Assert on OUR two attempts specifically (robust to any other attempts on this skill in the
    // shared e2e.db): they appear as points, wrong=0 / right=1, in ascending finishedAt order.
    const trend: any[] = await (await admin.get(`/api/analytics/students/${student.id}/skills/${SKILL_SLUG}/trend?subject=math`)).json();
    expect(Array.isArray(trend)).toBe(true);
    const wrongPt = trend.find((p) => p.attemptId === wrongAttemptId);
    const rightPt = trend.find((p) => p.attemptId === rightAttemptId);
    expect(wrongPt, 'wrong attempt appears in the trend').toBeTruthy();
    expect(rightPt, 'right attempt appears in the trend').toBeTruthy();
    expect(wrongPt.accuracy).toBe(0);
    expect(rightPt.accuracy).toBe(1);
    const wrongIdx = trend.indexOf(wrongPt);
    const rightIdx = trend.indexOf(rightPt);
    expect(wrongIdx, 'series is ascending by date — wrong (earlier) precedes right (later)').toBeLessThan(rightIdx);

    // Student is denied.
    const denied = await studentCtx.get(`/api/analytics/students/${student.id}/skills/${SKILL_SLUG}/trend?subject=math`);
    expect(denied.status()).toBe(403);

    await admin.dispose();
    await studentCtx.dispose();
  });
});
