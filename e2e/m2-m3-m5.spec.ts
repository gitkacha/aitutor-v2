import { test, expect } from '@playwright/test';

// M2/M3/M5 (docs/review.md §Medium):
//   M2 — the "All Topics" test must be capped at 35 questions and must keep
//        stimulus-group questions adjacent (the shuffle used to scatter them);
//   M3 — an unknown topic filter on GET /api/math/attempts must 404, not silently
//        return every attempt;
//   M5 — a failed heatmap fetch must show an error with a retry, not eternal
//        "Loading heatmap data...", and one failed subject must not hide the other.

test.describe('M2 — all-topics selection', () => {
  test('caps at 35 and keeps stimulus-group questions adjacent', async ({ request }) => {
    for (let run = 0; run < 3; run++) {
      const questions = await (await request.get('/api/math/questions')).json();
      expect(questions.length).toBeLessThanOrEqual(35);

      const groupIds = [...new Set(questions.map((q: any) => q.stimulusGroupId).filter(Boolean))];
      expect(groupIds.length, 'seeded bank must exercise at least one stimulus group').toBeGreaterThanOrEqual(1);
      for (const gid of groupIds) {
        const positions = questions
          .map((q: any, i: number) => (q.stimulusGroupId === gid ? i : -1))
          .filter((i: number) => i >= 0);
        expect(
          positions[positions.length - 1] - positions[0],
          `stimulus group ${gid} scattered on run ${run + 1}`
        ).toBe(positions.length - 1);
      }
    }
  });
});

test.describe('M3 — attempts topic filter', () => {
  test('unknown topic slug returns 404, not everything', async ({ request }) => {
    const res = await request.get('/api/math/attempts?topic=no-such-topic');
    expect(res.status()).toBe(404);
  });

  test('a valid topic slug still filters correctly', async ({ request }) => {
    const res = await request.get('/api/math/attempts?topic=arithmetic');
    expect(res.ok()).toBeTruthy();
    const attempts = await res.json();
    for (const a of attempts) {
      expect(a.topic?.slug).toBe('arithmetic');
    }
  });
});

test.describe('M5 — heatmap error states', () => {
  test('math heatmap failure shows an error with retry, then recovers', async ({ page }) => {
    await page.route('**/api/math/heatmap', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
    );
    await page.goto('/dashboard');

    await expect(page.getByText(/couldn't load this heatmap/i)).toBeVisible();
    await expect(page.getByText('Loading heatmap data...')).toHaveCount(0);

    await page.unroute('**/api/math/heatmap');
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page.getByText('Arithmetic')).toBeVisible();
  });

  test('a writing heatmap failure does not hide the math heatmap', async ({ page }) => {
    await page.route('**/api/heatmap', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' })
    );
    await page.goto('/dashboard');

    await expect(page.getByText(/couldn't load this heatmap/i)).toBeVisible();
    // The math heatmap still renders its topics despite the writing failure.
    await expect(page.getByText('Arithmetic')).toBeVisible();
  });
});
