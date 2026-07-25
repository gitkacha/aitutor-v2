import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { startChatStub, toolCall, narration } from './helpers/chat-stub';

// M3b-2 Task 5: the Improvement Journey renders a student's interventions in the admin view. We
// create a real intervention through the only path there is (the chat confirm flow), then drive
// the /admin UI: switch to the Mathematics tab, select the student, and assert the timeline card
// shows the recommendation, the frozen diagnosis skill, and an outcome status. Empty state before
// any student is selected.

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'directions';
const SKILL_SLUG = 'compass-directions';
const RECOMMENDATION = 'Practise compass directions with a short targeted set.';

async function createInterventionViaChat(admin: APIRequestContext, student: APIRequestContext): Promise<number> {
  const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
  const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
  const skill = await prisma.skill.findUniqueOrThrow({ where: { slug: SKILL_SLUG } });
  await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
  const stu = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

  const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
  const correctIndex: number = bank.find((r: any) => r.id === question.id).correctIndex;
  const now = new Date();
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

  const stub = await startChatStub([
    toolCall('create_intervention', { studentId: stu.id, skillSlugs: [SKILL_SLUG], recommendation: RECOMMENDATION, rationale: 'Early data suggests reinforcement here.' }),
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

test.describe('M3b-2 Task 5 — Improvement Journey', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('admin sees the intervention timeline for the selected student', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const studentId = await createInterventionViaChat(admin, student);

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    try {
      await page.goto('/admin');
      // The Admin content tab (not the sidebar's Mathematics accordion, which shares the name).
      await page.getByRole('button', { name: 'Mathematics' }).last().click();

      // Before selecting a student the journey isn't shown (workspace-wide view).
      await expect(page.getByTestId('improvement-journey')).toHaveCount(0);

      await page.locator('#perf-student').selectOption(String(studentId));

      const journey = page.getByTestId('improvement-journey');
      await expect(journey).toBeVisible();
      const card = journey.getByTestId('intervention-card').first();
      await expect(card).toBeVisible();
      await expect(card.getByText(RECOMMENDATION)).toBeVisible();
      await expect(card.getByText(/Compass Directions/i).first()).toBeVisible();
      // An outcome status chip is present (one of the three labels).
      await expect(card.locator('[data-status]').first()).toBeVisible();
    } finally {
      await ctx.close();
      await admin.dispose();
      await student.dispose();
    }
  });
});
