import { test, expect } from '@playwright/test';
import { startTest } from './helpers/practice';

// C1: starting a math timed practice must present questions with a running timer,
// not instantly auto-submit a blank attempt because timeLeft initialised to 0.
test.describe('C1 — math timed practice starts properly', () => {
  test('single-topic test shows a question and a non-zero timer, and does not auto-submit', async ({ page }) => {
    await page.goto('/math/arithmetic/start');
    await startTest(page);

    // A real question with its 5 option buttons must be visible.
    await expect(page.getByText('A', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible(); // progress "1 / N"

    // The countdown must start from the full allotment (~69s per question), not 0:00.
    const timerText = await page.locator('span', { hasText: /^\d+:\d{2}$/ }).first().textContent();
    expect(timerText).not.toBe('0:00');
    const [min] = timerText!.split(':').map(Number);
    expect(min).toBeGreaterThan(0);

    // Give any wrongly-fired auto-submit time to navigate, then confirm we are
    // still on the test screen and NOT on the attempt review page.
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/math/arithmetic/start');
    expect(page.url()).not.toContain('/math-attempt/');
  });

  test('all-topics test also starts without auto-submitting', async ({ page }) => {
    await page.goto('/math/all-topics/start');
    await startTest(page);
    await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();
    await page.waitForTimeout(3000);
    expect(page.url()).toContain('/math/all-topics/start');
    expect(page.url()).not.toContain('/math-attempt/');
  });
});
