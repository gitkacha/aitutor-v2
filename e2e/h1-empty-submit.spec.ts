import { test, expect } from '@playwright/test';

// H1 (docs/review.md §High): the 30 minutes expiring with an empty textarea must still save
// the attempt — an empty submission is a legitimate timed-out attempt. Backend validation
// used `!text`, so the auto-submit POST 400'd, the catch silently reset state, and the
// student sat stranded at 0:00. Any save failure must now show a visible error with a retry.

test.describe('H1 — empty writing attempt saves; save failures are visible', () => {
  test('POST /api/attempts accepts an empty text (timed-out attempt)', async ({ request }) => {
    const type = await (await request.get('/api/types/advertisement')).json();
    const promptId = type.prompts[0].id;
    const res = await request.post('/api/attempts', {
      data: {
        typeId: type.id,
        promptId,
        text: '',
        startedAt: new Date(Date.now() - 1_800_000).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: 1800,
        source: 'practice',
      },
    });
    expect(res.status()).toBe(201);
    const attempt = await res.json();
    expect(attempt.text).toBe('');
  });

  test('timer expiry with an empty textarea auto-submits and lands on the attempt page', async ({ page }) => {
    await page.clock.install();
    await page.goto('/practice/diary-entry');
    await page.getByRole('button', { name: 'Start Timed Practice' }).click();
    await expect(page.getByPlaceholder('Start writing here...')).toBeVisible();

    // Run the full 30 minutes without typing anything.
    await page.clock.runFor('30:01');

    await expect(page).toHaveURL(/\/attempt\/\d+/, { timeout: 15_000 });
  });

  test('a failed save shows a visible error with Try Again instead of stranding the student', async ({ page }) => {
    await page.route('**/api/attempts', (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'boom' }) });
      }
      return route.continue();
    });

    await page.goto('/practice/diary-entry');
    await page.getByRole('button', { name: 'Start Timed Practice' }).click();
    await page.getByPlaceholder('Start writing here...').fill('My diary entry.');
    await page.getByRole('button', { name: 'Submit Early' }).click();
    await page.getByRole('button', { name: 'Submit Now' }).click();

    await expect(page.getByText(/couldn't save your writing/i)).toBeVisible();

    // The student's work is not lost, and retrying after the outage succeeds.
    await page.unroute('**/api/attempts');
    await page.getByRole('button', { name: 'Try Again' }).click();
    await expect(page).toHaveURL(/\/attempt\/\d+/);
  });
});
