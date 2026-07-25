import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// M3c-1 Task 2 (W-59): the student-facing math improvements endpoint. Tag one 'perimeter' bank
// question (the report adapter isn't under test — computeSkillImprovements is), have the e2e
// student submit 8 dated attempts of it (4 older mostly-wrong, 4 newer mostly-right) so the
// accuracy branch of computeSkillImprovements clears both the evidence floor (8) and the gain
// threshold (>=8 pts). Then GET /api/analytics/me/improvements?subject=math as the student and as
// the admin (?studentId=), and confirm a throwaway second student — with no attempts on this
// skill — sees it absent. Answer key sourced from an admin request (W-28 pattern, mirrors
// e2e/m3b2-skill-trend.spec.ts).

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

// A topic/skill no other e2e spec tags (m3a-analytics=magic-squares, m3b-chat=probability,
// m3b-interventions=combinations, m3b2-skill-trend=rotation, m3b2-coach=weight,
// m3b2-trend=time, m3b2-journey=directions).
const TOPIC_SLUG = 'perimeter';
const SKILL_SLUG = 'perimeter-rectilinear';

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

test.describe('M3c-1 Task 2 — student-facing math improvements endpoint', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('a skill with a strong accuracy gain surfaces under its topic; own-data isolation; scope checks', async ({ baseURL }) => {
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

    // getMathImprovements windows to the student's last 10 MathAttempts (buildMathWindow). The
    // shared e2e.db carries attempts from every spec that runs in this suite, and specs
    // immediately before/after this one submit their own attempts with `new Date()` — i.e. real
    // wall-clock timestamps a handful of seconds either side of "now". Dating our "older" batch a
    // few seconds into the past (relative to "now") would land inside that same busy window and
    // let a neighbouring spec's attempts crowd ours out of the last-10 window. Anchoring instead
    // on a fixed far-future date sidesteps every other spec's timestamps (all "now" or fixed
    // past literals) entirely, so our 8 attempts are unambiguously the most recent for this
    // student regardless of run order or accumulated history.
    const anchor = new Date('2099-01-01T00:00:00.000Z').getTime();
    const olderAnswers = [wrongIndex, wrongIndex, wrongIndex, correctIndex];
    for (let i = 0; i < olderAnswers.length; i++) {
      await submitAttempt(studentCtx, question.id, olderAnswers[i], new Date(anchor + i * 1000));
    }
    // 4 newer attempts, all correct (100%), dated after the older batch.
    const newerAnswers = [correctIndex, correctIndex, correctIndex, correctIndex];
    for (let i = 0; i < newerAnswers.length; i++) {
      await submitAttempt(studentCtx, question.id, newerAnswers[i], new Date(anchor + (10 + i) * 1000));
    }

    // RED (pre-implementation): this GET 404s because the route doesn't exist yet.
    const studentRes = await studentCtx.get('/api/analytics/me/improvements?subject=math');
    expect(studentRes.status()).toBe(200);
    const studentBody = await studentRes.json();
    expect(Array.isArray(studentBody.topics)).toBe(true);
    const studentTopic = studentBody.topics.find((t: any) => t.slug === TOPIC_SLUG);
    expect(studentTopic, 'perimeter topic appears for the student').toBeTruthy();
    const studentSkill = studentTopic.skills.find((s: any) => s.slug === SKILL_SLUG);
    expect(studentSkill, 'perimeter-rectilinear skill appears under the topic').toBeTruthy();
    expect(studentSkill.metric).toBe('accuracy');
    expect(studentSkill.accuracyTo).toBeGreaterThan(studentSkill.accuracyFrom);
    expect(studentTopic.delta.metric).toBe('accuracy');

    // Admin, scoped to the e2e student, sees the same.
    const adminRes = await admin.get(`/api/analytics/me/improvements?subject=math&studentId=${student.id}`);
    expect(adminRes.status()).toBe(200);
    const adminBody = await adminRes.json();
    const adminTopic = adminBody.topics.find((t: any) => t.slug === TOPIC_SLUG);
    expect(adminTopic, 'admin sees the perimeter topic for the e2e student').toBeTruthy();
    expect(adminTopic.skills.some((s: any) => s.slug === SKILL_SLUG)).toBe(true);

    // A student requesting another user's data (out of scope) is denied.
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const deniedRes = await studentCtx.get(`/api/analytics/me/improvements?subject=math&studentId=${adminUser.id}`);
    expect(deniedRes.status()).toBe(404);

    // subject guard.
    const badSubject = await studentCtx.get('/api/analytics/me/improvements?subject=writing');
    expect(badSubject.status()).toBe(400);

    // Isolation: a throwaway second student, with no attempts on this skill, sees it absent.
    const otherEmail = `m3c1-other-${Date.now()}@test.local`;
    const created = await admin.post('/api/workspace/users', {
      data: { name: 'M3c1 Other', email: otherEmail, password: 'test1234', role: 'student' },
    });
    expect(created.ok()).toBeTruthy();
    const otherCtx = await pwRequest.newContext({ baseURL });
    const loginRes = await otherCtx.post('/api/auth/login', { data: { email: otherEmail, password: 'test1234' } });
    expect(loginRes.ok()).toBeTruthy();
    const otherRes = await otherCtx.get('/api/analytics/me/improvements?subject=math');
    expect(otherRes.status()).toBe(200);
    const otherBody = await otherRes.json();
    const otherTopic = otherBody.topics.find((t: any) => t.slug === TOPIC_SLUG);
    const otherHasSkill = otherTopic && otherTopic.skills.some((s: any) => s.slug === SKILL_SLUG);
    expect(otherHasSkill, 'a student with no attempts on this skill does not see it').toBeFalsy();

    await admin.dispose();
    await studentCtx.dispose();
    await otherCtx.dispose();
  });
});
