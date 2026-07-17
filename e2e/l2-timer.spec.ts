import { test, expect } from '@playwright/test';

// L2 (docs/review.md §Look & feel): the countdown must derive remaining time from
// timestamps, not tick-decrements — tick counting drifts and pauses in background tabs.
// Playwright's clock.fastForward fires the 1-second interval at most ONCE, so a
// tick-decrement timer reads 29:59 after a 5-minute jump while a timestamp-derived
// timer reads 25:00.

test.describe('L2 — timestamp-accurate countdown', () => {
  test('the writing timer stays correct across a 5-minute clock jump', async ({ page }) => {
    await page.clock.install();
    await page.goto('/practice/review');
    await page.getByRole('button', { name: 'Start Timed Practice' }).click();
    await expect(page.getByText('30:00')).toBeVisible();

    await page.clock.fastForward('05:00');

    await expect(page.getByText('25:00')).toBeVisible();
    await expect(page.getByText('29:59')).toHaveCount(0);
  });
});
