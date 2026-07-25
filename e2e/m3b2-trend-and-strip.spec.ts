import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// M3b-2 Task 6: the workspace active-interventions endpoint + strip, the per-skill trend chart,
// and the heatmap drill-to-skills. An intervention is created through the chat-confirm flow (which
// also gives the student a tagged attempt so the trend has a point), then the API and the admin UI
// are exercised.

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'time';
const TOPIC_NAME = 'Time';
const SKILL_SLUG = 'elapsed-time';

async function seedInterventionAndAttempts(admin: APIRequestContext, student: APIRequestContext): Promise<number> {
  const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
  const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
  const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
  await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
  const stu = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

  const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
  const correctIndex: number = bank.find((r: any) => r.id === question.id).correctIndex;
  for (let i = 0; i < 2; i++) {
    const now = new Date(Date.now() - (2 - i) * 86_400_000);
    await student.post('/api/math/attempts', {
      data: {
        questions: JSON.stringify([question.id]),
        answers: JSON.stringify([correctIndex]),
        startedAt: new Date(now.getTime() - 30_000).toISOString(),
        finishedAt: now.toISOString(),
        timeTaken: 30,
        source: 'practice',
      },
    });
  }

  const stub = await startChatStub([
    toolCall('create_intervention', { studentId: stu.id, skillSlugs: [SKILL_SLUG], recommendation: 'Elapsed-time practice.', rationale: 'Reinforce.' }),
    narration('Recorded.'),
  ]);
  try {
    const { id: sessionId } = await (await admin.post('/api/chat/sessions', { data: {} })).json();
    const step = await (await admin.post(`/api/chat/sessions/${sessionId}/messages`, { data: { content: 'Record an intervention.' } })).json();
    await admin.post(`/api/chat/sessions/${sessionId}/confirm`, { data: { actionId: step.pendingAction.id, approve: true } });
  } finally {
    await new Promise((r) => stub.close(r));
  }
  return stu.id;
}

test.describe('M3b-2 Task 6 — active endpoint, strip, trend chart, heatmap drill', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('GET /api/interventions/active lists workspace active interventions; student 403', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentId = await seedInterventionAndAttempts(admin, student);

    const active = await (await admin.get('/api/interventions/active')).json();
    expect(Array.isArray(active)).toBe(true);
    const mine = active.find((a: any) => a.studentId === studentId);
    expect(mine, 'the created active intervention is listed workspace-wide').toBeTruthy();
    expect(typeof mine.studentName).toBe('string');
    expect(mine.studentName.length).toBeGreaterThan(0);
    expect(typeof mine.status).toBe('string');
    // Friendly skill names, not raw slugs (the seeded 'elapsed-time' shows as 'Elapsed Time').
    expect(Array.isArray(mine.skillNames)).toBe(true);
    expect(mine.skillNames[0]).toBe('Elapsed Time');

    const denied = await student.get('/api/interventions/active');
    expect(denied.status()).toBe(403);

    await admin.dispose();
    await student.dispose();
  });

  test('admin UI: active strip, trend chart, and heatmap drill render', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentId = await seedInterventionAndAttempts(admin, student);

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    try {
      await page.goto('/admin');

      // Workspace-wide active interventions strip.
      await expect(page.getByTestId('active-interventions')).toBeVisible();
      const card = page.getByTestId('active-intervention-card').filter({ hasText: 'Elapsed Time' }).first();
      await expect(card).toBeVisible();

      // "View intervention" jumps to that student's Improvement Journey (math tab + selected).
      await card.getByRole('button', { name: /View intervention/ }).click();
      await expect(page.getByTestId('improvement-journey')).toBeVisible();
      await expect(page.locator('#perf-student')).toHaveValue(String(studentId));
      await expect(page.getByTestId('skill-trend-chart').first()).toBeVisible();

      // Heatmap drill: clicking a topic cell reveals its skills.
      await page.getByRole('button', { name: new RegExp(TOPIC_NAME) }).first().click();
      await expect(page.getByTestId('heatmap-skill-drill')).toBeVisible();
    } finally {
      await ctx.close();
      await admin.dispose();
      await student.dispose();
    }
  });
});
