import { test, expect } from '@playwright/test';

test.describe('e2e stack smoke', () => {
  test('backend serves seeded data through the frontend proxy', async ({ request }) => {
    const types = await request.get('/api/types');
    expect(types.ok()).toBeTruthy();
    expect((await types.json()).length).toBeGreaterThanOrEqual(11);

    const topics = await request.get('/api/math/topics');
    expect(topics.ok()).toBeTruthy();
    expect((await topics.json()).length).toBeGreaterThanOrEqual(20);
  });

  test('dashboard renders with sidebar navigation', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Selective Coach' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Persuasive' })).toBeVisible();
  });
});
