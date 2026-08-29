import { test, expect } from '@playwright/test';

// Phase A / A1 (W-100): the shared math/thinking-skills practice pages must state the correct
// option count per subject — Thinking Skills is 4 options (A-D), Mathematics is 5 (A-E). The copy
// was hardcoded to Math's "5 (A-E)", which is wrong on every Thinking Skills page.
test.describe('W-100 — subject-aware option-count copy', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });

  test('Thinking Skills practice page shows 4 options (A-D)', async ({ page }) => {
    await page.goto('/math/visual-reasoning');
    await expect(page.getByRole('heading', { name: 'Visual Reasoning' })).toBeVisible();

    await expect(page.getByText(/4 answer options per question \(A-D\)/)).toBeVisible();
    await expect(page.getByText(/5 answer options per question \(A-E\)/)).toHaveCount(0);
  });

  test('Mathematics practice page still shows 5 options (A-E)', async ({ page }) => {
    await page.goto('/math/arithmetic');
    await expect(page.getByRole('heading', { name: 'Arithmetic' })).toBeVisible();

    await expect(page.getByText(/5 answer options per question \(A-E\)/)).toBeVisible();
    await expect(page.getByText(/4 answer options per question \(A-D\)/)).toHaveCount(0);
  });

  test('Thinking Skills timed-practice start screen reads "4 options each"', async ({ page }) => {
    await page.goto('/math/visual-reasoning/start');
    await expect(page.getByRole('heading', { name: 'Ready to start?' })).toBeVisible();
    await expect(page.getByText(/4 options each/)).toBeVisible();
  });
});
