import { test, expect } from '@playwright/test';

// W-96 (Thinking Skills, Task 8): the sidebar shows a "Thinking Skills" section after Mathematics,
// with the 7 subsections; clicking one opens its topic page.
test.describe('W-96 — sidebar Thinking Skills section', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });

  test('Thinking Skills appears after Mathematics with the 7 sections and links work', async ({ page }) => {
    await page.goto('/dashboard');

    const nav = page.locator('aside').first();
    await expect(nav.getByRole('button', { name: /Thinking Skills/ })).toBeVisible();

    // Order: Mathematics before Thinking Skills.
    const text = await nav.textContent();
    expect(text!.indexOf('Mathematics')).toBeLessThan(text!.indexOf('Thinking Skills'));

    // Expand and check a couple of the 7 sections, then click one.
    await nav.getByRole('button', { name: /Thinking Skills/ }).click();
    await expect(nav.getByRole('link', { name: 'Logical Analysis' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Visual Reasoning' })).toBeVisible();
    await nav.getByRole('link', { name: 'Logical Analysis' }).click();
    await expect(page).toHaveURL(/\/math\/logical-analysis/);
    await expect(page.getByRole('heading', { name: 'Logical Analysis' })).toBeVisible();
  });
});
