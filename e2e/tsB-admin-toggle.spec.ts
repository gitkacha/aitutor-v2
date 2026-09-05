import { test, expect } from '@playwright/test';

// Phase B follow-on / W-109: the Admin subject toggle is three-way (Writing · Mathematics ·
// Thinking Skills). The Thinking Skills tab carries TS Performance + the TS generate card; that
// card is not shown under the other tabs.
test.describe('W-109 — Thinking Skills in the Admin subject toggle', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });

  test('a Thinking Skills tab shows TS performance + the generate card, scoped to that tab', async ({ page }) => {
    await page.goto('/admin');

    const tsTab = page.getByRole('button', { name: 'Thinking Skills', exact: true });
    await expect(tsTab).toBeVisible();

    // Default tab (Writing) must not show the TS generate card.
    await expect(page.getByTestId('ts-generate')).toHaveCount(0);

    // Mathematics tab: still no TS card.
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mathematics Performance' })).toBeVisible();
    await expect(page.getByTestId('ts-generate')).toHaveCount(0);

    // Thinking Skills tab: TS performance + the generate card appear.
    await tsTab.click();
    await expect(page.getByRole('heading', { name: 'Thinking Skills Performance' })).toBeVisible();
    await expect(page.getByTestId('ts-generate')).toBeVisible();
  });
});
