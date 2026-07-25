import { test, expect } from '@playwright/test';

// W-57: the admin dashboard must be locked to admins on the frontend too (the backend routes
// already 403). A student visiting /admin is redirected to /dashboard, and the admin-only sidebar
// section (Admin / Coach Chat / Skills) is hidden entirely for students. Runs as the seeded e2e
// student (the suite's default storageState).

test.describe('W-57 — admin dashboard locked to admins', () => {
  test('a student is redirected away from /admin and sees no admin sidebar links', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Coach Chat' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Skills' })).toHaveCount(0);
  });

  test('an admin can still reach /admin', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await ctx.close();
  });
});
