import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// M3a Task 6: GET /api/analytics/students/:id/report (admin-only skill report) and
// GET /api/analytics/opportunity-areas. Skill-tagging of the bank (Task 8's AI-generation
// tagging and Task 9's backfill script) hasn't landed yet, so this spec tags one bank
// question directly via Prisma as a fixture — the report *adapter* is what's under test
// here, not tagging.

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('M3a Task 6 — analytics report + opportunity areas', () => {
  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test('report shows exact tagged-skill counts, gates sufficientEvidence, and is admin-only', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    // Fixture: tag the single 'magic-squares' bank question with a skill. An unusual topic
    // (per the M3a Task 6 brief) so this spec's counts stay exact regardless of what other
    // specs attempted elsewhere in the same run.
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: 'magic-squares' } });
    const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
    const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: 'magic-square-completion' } });
    await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });

    const me = await (await student.get('/api/auth/me')).json();
    const studentId: number = me.user.id;

    // Source the answer key as admin (W-28 pattern: the student payload strips correctIndex).
    const bank = await (await admin.get('/api/math/questions?topic=magic-squares')).json();
    const q = bank.find((row: any) => row.id === question.id);
    const options: string[] = JSON.parse(q.options);
    const correctIndex: number = q.correctIndex;
    const wrongIndex = (correctIndex + 1) % options.length;

    const submit = async (answerIndex: number) => {
      const finishedAt = new Date();
      const startedAt = new Date(finishedAt.getTime() - 30_000);
      const res = await student.post('/api/math/attempts', {
        data: {
          questions: JSON.stringify([question.id]),
          answers: JSON.stringify([answerIndex]),
          // Capture instrumentation isn't persisted until Task 7 wires up the POST route;
          // included here so the payload is already forward-compatible, and so the report
          // adapter is exercised with (currently ignored) timing data present in the request.
          questionTimings: JSON.stringify({ [question.id]: 12000 }),
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          timeTaken: 30,
          source: 'practice',
        },
      });
      expect(res.status()).toBe(201);
    };

    // Two attempts at the same question: one right, one wrong.
    await submit(correctIndex);
    await submit(wrongIndex);

    const reportRes = await admin.get(`/api/analytics/students/${studentId}/report?subject=math`);
    expect(reportRes.status()).toBe(200);
    const report = await reportRes.json();

    const skillSig = report.skills.find((s: any) => s.slug === 'magic-square-completion');
    expect(skillSig, 'the tagged skill must appear in the report').toBeTruthy();
    expect(skillSig.attempted).toBe(2);
    expect(skillSig.correct).toBe(1);
    // Evidence floor is 8 attempted questions — 2 attempted must not be reported as sufficient.
    expect(skillSig.sufficientEvidence).toBe(false);

    expect(report.window.tests).toBeGreaterThanOrEqual(2);
    expect(typeof report.window.untaggedQuestions).toBe('number');

    // Admin-only: a student-context request to the same URL is rejected, not just filtered.
    const studentReportRes = await student.get(`/api/analytics/students/${studentId}/report?subject=math`);
    expect([403, 404]).toContain(studentReportRes.status());

    await admin.dispose();
    await student.dispose();
  });

  test('opportunity-areas requires a subject and is admin-only', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    const missingSubject = await admin.get('/api/analytics/opportunity-areas');
    expect(missingSubject.status()).toBe(400);

    const ok = await admin.get('/api/analytics/opportunity-areas?subject=math');
    expect(ok.status()).toBe(200);
    expect(Array.isArray(await ok.json())).toBe(true);

    const forbidden = await student.get('/api/analytics/opportunity-areas?subject=math');
    expect([403, 404]).toContain(forbidden.status());

    await admin.dispose();
    await student.dispose();
  });
});
