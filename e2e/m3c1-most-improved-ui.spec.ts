import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// M3c-1 Task 4 (W-59): the "Most Improved" panel on the student Dashboard, consuming the Task 2
// endpoint (GET /api/analytics/me/improvements?subject=math). Reuses the tagging + dated-attempts
// setup pattern from e2e/m3c1-improvements.spec.ts (Task 2), but on its OWN topic/skill pair —
// reusing Task 2's 'perimeter'/'perimeter-rectilinear' pair (and its identical anchor timestamp
// formula) would duplicate MathAttempt rows at the exact same finishedAt values, so the shared
// e2e.db's buildMathWindow (last-10-attempts-overall) would blend both specs' attempts into one
// window and dilute/mask the accuracy gain. This spec tags the SKILL 'fraction-word-problems'
// (untouched by every other e2e spec — the 'fractions' topic is used elsewhere, but not this
// skill, which is what the per-skill improvement computation keys on).

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'fractions';
const SKILL_SLUG = 'fraction-word-problems';

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

test.describe('M3c-1 Task 4 — Most Improved dashboard panel', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('shows an improving topic/skill for the seeded student; absent for a student with no improvements', async ({ page, baseURL }) => {
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
    const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
    const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
    await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });

    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    const adminQs = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
    const correctIndex: number = adminQs.find((q: any) => q.id === question.id).correctIndex;
    const wrongIndex = (correctIndex + 1) % 5;

    // See e2e/m3c1-improvements.spec.ts for why the far-future anchor is used: it keeps this
    // spec's 8 attempts unambiguously the most recent for the student regardless of run order.
    // buildMathWindow windows to the student's last 10 MathAttempts *across all skills*, so this
    // anchor is offset an hour past Task 2's identical-formula anchor — Task 2 runs first
    // (alphabetically earlier filename) and seeds 8 attempts at the same base date; without the
    // offset our two specs' attempts would tie on finishedAt and the shared 10-attempt window
    // could crowd out this skill's own older half, starving it below the evidence floor.
    const anchor = new Date('2099-01-01T01:00:00.000Z').getTime();
    const olderAnswers = [wrongIndex, wrongIndex, wrongIndex, correctIndex];
    for (let i = 0; i < olderAnswers.length; i++) {
      await submitAttempt(studentCtx, question.id, olderAnswers[i], new Date(anchor + i * 1000));
    }
    const newerAnswers = [correctIndex, correctIndex, correctIndex, correctIndex];
    for (let i = 0; i < newerAnswers.length; i++) {
      await submitAttempt(studentCtx, question.id, newerAnswers[i], new Date(anchor + (10 + i) * 1000));
    }

    // Sanity: the endpoint does surface the topic/skill for this student (mirrors Task 2 spec).
    const studentRes = await studentCtx.get('/api/analytics/me/improvements?subject=math');
    expect(studentRes.status()).toBe(200);
    const studentBody = await studentRes.json();
    const studentTopic = studentBody.topics.find((t: any) => t.slug === TOPIC_SLUG);
    expect(studentTopic, 'perimeter topic appears for the student').toBeTruthy();

    // UI: the default e2e student (storageState from playwright.config.ts) sees the panel.
    await page.goto('/dashboard');
    const panel = page.getByTestId('most-improved');
    await expect(panel).toBeVisible();
    await expect(panel.getByText("You're getting better at…")).toBeVisible();
    const topicRow = panel.getByText(topic.name, { exact: false });
    await expect(topicRow.first()).toBeVisible();
    await topicRow.first().click();
    await expect(panel.getByText(skill.name, { exact: false })).toBeVisible();
    const badge = panel.getByText(/→|quicker/);
    await expect(badge.first()).toBeVisible();

    // Absent for a fresh throwaway student with no improvements.
    const otherEmail = `m3c1-ui-other-${Date.now()}@test.local`;
    const created = await admin.post('/api/workspace/users', {
      data: { name: 'M3c1 UI Other', email: otherEmail, password: 'test1234', role: 'student' },
    });
    expect(created.ok()).toBeTruthy();
    const otherCtx = await pwRequest.newContext({ baseURL });
    const loginRes = await otherCtx.post('/api/auth/login', { data: { email: otherEmail, password: 'test1234' } });
    expect(loginRes.ok()).toBeTruthy();
    const state = await otherCtx.storageState();

    // Use a fresh browser context with the throwaway student's storage state.
    const browserCtx = await page.context().browser()!.newContext({ baseURL, storageState: state });
    const otherBrowserPage = await browserCtx.newPage();
    await otherBrowserPage.goto('/dashboard');
    await expect(otherBrowserPage.getByTestId('most-improved')).toHaveCount(0);
    await browserCtx.close();

    await admin.dispose();
    await studentCtx.dispose();
    await otherCtx.dispose();
  });
});
