import { test, expect } from '@playwright/test';

// Phase B / B3 (W-107): the admin Skills taxonomy page shows a Thinking Skills group with its
// sections/skills, mirroring the Mathematics groups.
test.describe('W-107 — Skills page shows Thinking Skills', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('the taxonomy lists a Thinking Skills group with its skills', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByRole('heading', { name: 'Skills', exact: true })).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Thinking Skills' })).toBeVisible();
    const group = page.locator('section', { has: page.getByRole('heading', { name: 'Thinking Skills' }) });
    await expect(group.getByText('Finding Procedures')).toBeVisible();
    await expect(group.getByText('Visual Reasoning')).toBeVisible();
  });
});
