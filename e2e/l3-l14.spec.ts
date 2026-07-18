import { test, expect } from '@playwright/test';

// L3–L14 (docs/review2.md §Low) — e2e-provable slices:
// L3 — writing routes must 400 (not 500) on non-numeric ids.
// L4 — ScoreHistory must show an error panel with retry, never the empty state, on a
//      failed fetch.
// L6 — a successful-but-empty heatmap response is "no data", not an eternal load.
// L8 — GET /api/stats serves the weekly session count (demo excluded) and the sidebar
//      no longer fetches full attempt lists on navigation.
// L12 — the error middleware honours client-error statuses and never leaks internals.
// L14 — worksheet save rejects a types/prompts count mismatch.

test.describe('L3 — non-numeric ids are client errors', () => {
  test('GET /api/attempts/abc and POST /api/analysis/abc return 400', async ({ request }) => {
    expect((await request.get('/api/attempts/abc')).status()).toBe(400);
    expect((await request.post('/api/analysis/abc')).status()).toBe(400);
  });
});

test.describe('L4 — ScoreHistory distinguishes error from empty', () => {
  test('a failed fetch shows the error panel; Try Again recovers', async ({ page }) => {
    await page.route('**/api/attempts?type=persuasive*', (route) => route.abort());
    await page.route('**/api/types/persuasive', (route) => route.abort());

    await page.goto('/history/persuasive');
    await expect(page.getByText("Couldn't load this history")).toBeVisible();
    await expect(page.getByText('No completed attempts')).not.toBeVisible();

    await page.unroute('**/api/attempts?type=persuasive*');
    await page.unroute('**/api/types/persuasive');
    await page.getByRole('button', { name: 'Try Again' }).click();
    // Recovery: the type name only renders after a successful refetch.
    await expect(page.getByRole('heading', { name: /Persuasive.*Score History/ })).toBeVisible();
    await expect(page.getByText("Couldn't load this history")).not.toBeVisible();
  });
});

test.describe('L6 — empty heatmap data is not "loading"', () => {
  test('an empty writing heatmap shows the no-data message', async ({ page }) => {
    await page.route('**/api/heatmap', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );
    await page.goto('/dashboard');
    await expect(page.getByText('No heatmap data available.')).toBeVisible();
    await expect(page.getByText('Loading heatmap data...')).not.toBeVisible();
  });
});

test.describe('L8 — sidebar momentum comes from /api/stats, demo excluded', () => {
  test('GET /api/stats counts this week non-demo sessions', async ({ request }) => {
    const weekStart = (() => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      return d.getTime();
    })();
    const expectedCount = async () => {
      const [writing, math] = await Promise.all([
        (await request.get('/api/attempts')).json(),
        (await request.get('/api/math/attempts')).json(),
      ]);
      return [...writing, ...math].filter(
        (a: any) => !a.isDemo && new Date(a.finishedAt).getTime() >= weekStart
      ).length;
    };

    const res = await request.get('/api/stats');
    expect(res.status(), 'GET /api/stats must exist').toBe(200);
    expect((await res.json()).sessionsThisWeek).toBe(await expectedCount());

    // Demo attempts never inflate the count.
    const load = await request.post('/api/demo/load');
    expect(load.ok()).toBeTruthy();
    try {
      expect((await (await request.get('/api/stats')).json()).sessionsThisWeek).toBe(
        await expectedCount()
      );
    } finally {
      expect((await request.post('/api/demo/clear')).ok()).toBeTruthy();
    }
  });

  test('loading the dashboard fetches no full attempt lists', async ({ page }) => {
    const listRequests: string[] = [];
    page.on('request', (req) => {
      const path = new URL(req.url()).pathname;
      if (path === '/api/attempts' || path === '/api/math/attempts') listRequests.push(path);
    });
    await page.goto('/dashboard');
    await expect(page.getByText(/of 5 sessions/)).toBeVisible();
    expect(listRequests, 'sidebar must not fetch full attempt lists').toEqual([]);
  });
});

test.describe('L12 — error middleware honours status and hides internals', () => {
  test('malformed JSON body is a 400; internal failures return a generic 500', async ({ request }) => {
    const malformed = await request.post('/api/attempts', {
      headers: { 'content-type': 'application/json' },
      data: 'not-json{{',
    });
    expect(malformed.status()).toBe(400);

    // Valid fields but an unparseable date — rejects inside Prisma, a true 500.
    const internal = await request.post('/api/attempts', {
      data: {
        typeId: 1,
        promptId: 1,
        text: 'hello',
        startedAt: 'not-a-date',
        finishedAt: 'not-a-date',
        timeTaken: 60,
      },
    });
    expect(internal.status()).toBe(500);
    const body = await internal.json();
    expect(body.error).toBe('Internal server error');
  });
});

test.describe('L14 — worksheet save validates prompt/type counts', () => {
  test('two typeIds with one prompt is rejected, not silently duplicated', async ({ request }) => {
    const discussion = await (await request.get('/api/types/discussion')).json();
    const review = await (await request.get('/api/types/review')).json();
    const res = await request.post('/api/worksheets/save', {
      data: { title: 'L14 mismatch', typeIds: [discussion.id, review.id], prompts: ['only one'] },
    });
    expect(res.status()).toBe(400);
  });
});
