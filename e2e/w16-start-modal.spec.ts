import { test, expect } from '@playwright/test';

// W-16: a start-test confirmation gates both timed screens — the clock doesn't run until
// the student presses Start test. Runs as the seeded e2e student (default storageState).

test.describe('W-16 — start-test confirmation', () => {
  test('writing: the editor and timer wait behind a Start test confirmation', async ({ page }) => {
    await page.goto('/practice/persuasive');
    await page.getByRole('button', { name: 'Start Timed Practice' }).click();

    // Pre-start: a confirmation card, no editor yet.
    await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible();
    await expect(page.locator('textarea')).toHaveCount(0);

    await page.getByRole('button', { name: 'Start test' }).click();

    // The editor and the countdown appear only after confirming.
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByText(/^\d?\d:\d\d$/)).toBeVisible(); // timer readout
  });

  test('math: the questions wait behind a Start test confirmation showing the question count', async ({ page }) => {
    await page.goto('/math/fractions/start');

    await expect(page.getByRole('button', { name: 'Start test' })).toBeVisible();
    // The card names how many questions and no answer options are shown yet.
    await expect(page.getByText(/\d+ questions?/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^A\b/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Start test' }).click();

    // The first question and the countdown appear.
    await expect(page.getByText(/^\d?\d:\d\d$/)).toBeVisible();
    await expect(page.getByText(/1 \/ \d+/)).toBeVisible();
  });
});
