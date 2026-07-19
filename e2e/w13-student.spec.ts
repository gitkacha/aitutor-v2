import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';

// W-13 / Milestone 2 Phase C2 (docs/superpowers/plans/Milestone2-plan.md): the student
// experience — opportunity areas on the dashboard, and assigned-only worksheet lists.
// Runs as the seeded e2e student (the suite default storageState).

async function adminCtx(baseURL: string | undefined): Promise<APIRequestContext> {
  const ctx = await pwRequest.newContext({ baseURL });
  const res = await ctx.post('/api/auth/login', { data: { email: 'e2e-admin@test.local', password: 'test1234' } });
  expect(res.ok()).toBeTruthy();
  return ctx;
}

test.describe('W-13 — student experience', () => {
  test('the dashboard surfaces the student\'s weakest scored areas as opportunity areas', async ({ page, request }) => {
    // A deterministic low score on an uncommon topic → guaranteed among the weakest.
    const topic = await (await request.get('/api/math/topics/time-zones')).json();
    const q = topic.questions[0];
    const now = Date.now();
    const res = await request.post('/api/math/attempts', {
      data: {
        topicId: topic.id,
        questions: JSON.stringify([q.id]),
        answers: JSON.stringify([(q.correctIndex + 1) % 5]), // wrong on purpose → 0%
        startedAt: new Date(now - 60_000).toISOString(),
        finishedAt: new Date(now).toISOString(),
        timeTaken: 60,
        source: 'practice',
      },
    });
    expect(res.status()).toBe(201);

    await page.goto('/dashboard');
    const section = page.locator('section').filter({ hasText: 'Opportunity Areas' });
    await expect(section, 'opportunity areas section must exist').toBeVisible();
    await expect(section.getByRole('button', { name: /Time Zones/ })).toBeVisible();
  });

  test('the student\'s pending list shows worksheets assigned to them, not to other students', async ({ page, request, baseURL }) => {
    const me = await (await request.get('/api/auth/me')).json();
    const myId: number = me.user.id;

    const admin = await adminCtx(baseURL);
    // A throwaway student to receive the "other" worksheet.
    const otherEmail = `w13-other-${Date.now()}@test.local`;
    const other = await admin.post('/api/workspace/users', {
      data: { name: 'W13 Other', email: otherEmail, password: 'test1234', role: 'student' },
    });
    const otherId = (await other.json()).user.id;

    const type = await (await request.get('/api/types/review')).json();
    const mineTitle = `W13 mine ${Date.now()}`;
    const otherTitle = `W13 other ${Date.now()}`;
    await admin.post('/api/worksheets/save', {
      data: { title: mineTitle, typeIds: [type.id], prompts: ['A review for me.'], studentIds: [myId] },
    });
    await admin.post('/api/worksheets/save', {
      data: { title: otherTitle, typeIds: [type.id], prompts: ['A review for someone else.'], studentIds: [otherId] },
    });
    await admin.dispose();

    await page.goto('/dashboard');
    const pending = page.locator('section', { hasText: 'Pending Worksheets' });
    await expect(pending.getByText(mineTitle)).toBeVisible();
    await expect(pending.getByText(otherTitle)).not.toBeVisible();
  });
});
