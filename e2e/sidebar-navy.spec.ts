import { test, expect, APIRequestContext, request as pwRequest } from '@playwright/test';
import { startTest } from './helpers/practice';

// "Evening Navy" sidebar redesign (docs/mocks/example2.html):
//   - weekly momentum ring ("N of 5 sessions done") at the top of the rail;
//   - "Subjects" / "Coach" section labels, Admin under Coach;
//   - per-topic scores in the nav, colour-coded; untouched topics show "—";
//   - "Up next" footer card starts the oldest pending worksheet in one tap;
//   - focus mode: the rail collapses to an icon strip during timed practice.

async function oldestPendingTitle(request: APIRequestContext): Promise<string> {
  const [writing, math] = await Promise.all([
    (await request.get('/api/worksheets')).json(),
    (await request.get('/api/math/worksheets')).json(),
  ]);
  const pending = [...writing, ...math].filter((ws: any) => (ws.attempts || []).length === 0);
  pending.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return pending[0]?.title;
}

test.describe('evening navy sidebar', () => {
  test('shows the weekly momentum ring and Subjects/Coach section labels', async ({ page }) => {
    await page.goto('/dashboard');
    const rail = page.locator('aside');
    await expect(rail.getByText(/of 5 sessions/)).toBeVisible();
    await expect(rail.getByText('Subjects', { exact: true })).toBeVisible();
    await expect(rail.getByText('Coach', { exact: true })).toBeVisible();
    await expect(rail.getByRole('link', { name: 'Admin' })).toBeVisible();
  });

  test('nav items carry colour-coded scores; untouched topics show a dash', async ({ page, request, baseURL }) => {
    // Score 100% on Directions (a topic no other spec touches). The student payload omits the
    // answer key (W-28), so the correct answers come from an admin fetch, mapped by id.
    const questions = await (await request.get('/api/math/questions?topic=directions')).json();
    expect(questions.length).toBeGreaterThanOrEqual(1);
    const qIds = questions.map((q: any) => q.id);
    const admin = await pwRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await admin.post('/api/auth/login', { data: { email: 'e2e-admin@test.local', password: 'test1234' } });
    const keyById = new Map(
      (await (await admin.get('/api/math/questions?topic=directions')).json())
        .map((q: any) => [q.id, q.correctIndex]),
    );
    await admin.dispose();
    const now = Date.now();
    const created = await request.post('/api/math/attempts', {
      data: {
        topicId: questions[0].topicId,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(qIds.map((id: number) => keyById.get(id))),
        startedAt: new Date(now - 60_000).toISOString(),
        finishedAt: new Date(now).toISOString(),
        timeTaken: 60,
        source: 'practice',
      },
    });
    expect(created.status()).toBe(201);

    await page.goto('/dashboard');
    const rail = page.locator('aside');
    await rail.getByRole('button', { name: 'Mathematics' }).click();
    await expect(rail.getByRole('link', { name: 'Directions' })).toContainText('100%');

    // An untouched writing type shows a quiet dash, not a zero.
    await expect(rail.getByRole('link', { name: 'Speech' })).toContainText('—');
  });

  test('Up next card lists the oldest pending worksheet and starts it in one tap', async ({ page, request, baseURL }) => {
    // Worksheet creation is admin-only (Milestone 2 B1); the admin saves it and it is
    // auto-assigned to every student, so the default e2e student sees it as pending.
    const admin = await pwRequest.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await admin.post('/api/auth/login', { data: { email: 'e2e-admin@test.local', password: 'test1234' } });
    const save = await admin.post('/api/math/worksheets/save', {
      data: {
        title: `E2E Sidebar UpNext ${Date.now()}`,
        topicIds: ['arithmetic'],
        questions: [
          { questionText: 'What is 9 + 8?', options: ['15', '16', '17', '18', '19'], correctIndex: 2, explanation: '9 + 8 = 17.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
        ],
      },
    });
    expect(save.status()).toBe(201);
    await admin.dispose();

    const expectedTitle = await oldestPendingTitle(request);
    expect(expectedTitle).toBeTruthy();

    await page.goto('/dashboard');
    const rail = page.locator('aside');
    await expect(rail.getByText('Up next')).toBeVisible();
    await expect(rail.getByText(expectedTitle)).toBeVisible();
    await rail.getByRole('button', { name: 'Start', exact: true }).click();
    // Lands straight on a timed test screen (question progress indicator).
    await startTest(page);
    await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();
  });

  test('focus mode: the rail collapses to an icon strip during timed practice', async ({ page }) => {
    await page.goto('/math/arithmetic/start');
    await startTest(page);
    await expect(page.getByTestId('sidebar-focus')).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Dashboard' })).toHaveCount(0);
    await expect(page.locator('aside').getByText(/of 5 sessions/)).toHaveCount(0);
  });
});
