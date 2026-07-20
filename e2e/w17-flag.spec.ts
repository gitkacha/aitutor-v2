import { test, expect } from '@playwright/test';
import { startTest } from './helpers/practice';

// W-17: in the math test a student can flag a question and, from the Submit-All confirm
// screen, jump back to flagged or unanswered questions while time remains.

test.describe('W-17 — flag a math question and revisit', () => {
  test('flagging a question surfaces it on the submit confirmation with a jump-back chip', async ({ page }) => {
    await page.goto('/math/all-topics/start');
    await startTest(page);
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();

    // Flag question 1, answer nothing, and open Submit All.
    await page.getByRole('button', { name: /^Flag/ }).click();
    await expect(page.getByRole('button', { name: /^(Unflag|Flagged)/ })).toBeVisible();

    // Move to question 2 so we're not sitting on Q1 when we jump back.
    await page.getByRole('button', { name: 'Next' }).click();
    await expect(page.getByText(/^2 \/ \d+$/)).toBeVisible();

    await page.getByRole('button', { name: 'Submit All' }).click();

    // The confirm screen lists the flagged question (Q1) as a jump chip.
    await expect(page.getByText(/Flagged \(1\)/)).toBeVisible();
    const flaggedChip = page.getByTestId('jump-flagged').getByRole('button', { name: 'Q1', exact: true });
    await expect(flaggedChip).toBeVisible();

    // Jumping returns to question 1 (and out of the confirm screen).
    await flaggedChip.click();
    await expect(page.getByText(/^1 \/ \d+$/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Now' })).toHaveCount(0);
  });
});
