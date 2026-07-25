import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// M3b-2 Task 4: the Coach Chat PAGE drives the M3b chat API through the browser. A scripted stub
// on :3106 decides the model's turns; the tool RESULTS still come from the real DB, so we seed one
// tagged attempt for the e2e student first. Covers: a grounded read renders a data card + chips and
// a chip click sends; an action tool surfaces a confirmation card that mutates only on Confirm;
// and a student can't reach /coach.

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

// A topic/skill no other spec tags (probability=m3b-chat, combinations=m3b-interventions,
// rotation=m3b2-skill-trend, magic-squares=m3a-analytics).
const TOPIC_SLUG = 'weight';
const SKILL_SLUG = 'unit-conversion-mass';

async function seedTaggedAttempt(admin: APIRequestContext, student: APIRequestContext): Promise<number> {
  const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
  const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
  const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
  await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
  const student_ = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

  const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
  const correctIndex: number = bank.find((r: any) => r.id === question.id).correctIndex;
  const finishedAt = new Date();
  const res = await student.post('/api/math/attempts', {
    data: {
      questions: JSON.stringify([question.id]),
      answers: JSON.stringify([correctIndex]),
      startedAt: new Date(finishedAt.getTime() - 30_000).toISOString(),
      finishedAt: finishedAt.toISOString(),
      timeTaken: 30,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return student_.id;
}

test.describe('M3b-2 Task 4 — Coach Chat page', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('admin: grounded read renders a data card + chips; a chip click sends', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentId = await seedTaggedAttempt(admin, student);

    const stub = await startChatStub([
      toolCall('get_student_skill_report', { studentId, subject: 'math' }),
      narration('This student has attempted mass-unit conversion; not enough data to judge it yet.'),
      narration('Here is a bit more detail on that.'),
    ]);
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    try {
      await page.goto('/coach');
      await page.getByPlaceholder('Ask about a student…').fill('How is E2E Student doing in maths?');
      await page.getByRole('button', { name: 'Send' }).click();

      // The tool result renders as a data card, and grounded chips appear.
      await expect(page.getByText('Skill report')).toBeVisible();
      const chips = page.getByTestId('suggested-chip');
      await expect(chips.first()).toBeVisible();
      const chipText = (await chips.first().innerText()).trim();

      // Clicking a chip sends it — it shows up as a user turn.
      await chips.first().click();
      await expect(page.locator('[data-role="user"]').filter({ hasText: chipText })).toBeVisible();
    } finally {
      await ctx.close();
      await new Promise((r) => stub.close(r));
      await admin.dispose();
      await student.dispose();
    }
  });

  test('admin: an action surfaces a confirmation card and mutates only on Confirm', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentId = await seedTaggedAttempt(admin, student);
    const beforeCount = (await (await admin.get(`/api/interventions?studentId=${studentId}`)).json()).length;

    const stub = await startChatStub([
      toolCall('create_intervention', {
        studentId,
        skillSlugs: [SKILL_SLUG],
        recommendation: 'Targeted mass-unit conversion practice.',
        rationale: 'Early data suggests reinforcement here.',
      }),
      narration('Recorded the intervention.'),
    ]);
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    try {
      await page.goto('/coach');
      await page.getByPlaceholder('Ask about a student…').fill('Record an intervention for E2E Student.');
      await page.getByRole('button', { name: 'Send' }).click();

      await expect(page.getByTestId('pending-action')).toBeVisible();
      // No row written before confirmation.
      const mid = (await (await admin.get(`/api/interventions?studentId=${studentId}`)).json()).length;
      expect(mid).toBe(beforeCount);

      await page.getByRole('button', { name: 'Confirm' }).click();
      await expect(page.getByTestId('pending-action')).toBeHidden();
      await expect
        .poll(async () => (await (await admin.get(`/api/interventions?studentId=${studentId}`)).json()).length)
        .toBe(beforeCount + 1);
    } finally {
      await ctx.close();
      await new Promise((r) => stub.close(r));
      await admin.dispose();
      await student.dispose();
    }
  });

  test('student: no Coach link and /coach redirects to the dashboard', async ({ page }) => {
    await page.goto('/coach');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Coach Chat' })).toHaveCount(0);
  });
});
