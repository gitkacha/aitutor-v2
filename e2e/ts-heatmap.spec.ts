import { test, expect } from '@playwright/test';

// W-98: Thinking Skills sections appear under their OWN heatmap, not under Mathematics. The math
// heatmap route is subject-aware (default 'math'); the Dashboard shows a separate Thinking Skills
// heatmap.
test.describe('W-98 — Thinking Skills heatmap is separate from Mathematics', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });

  test('math heatmap excludes thinking-skills; ?subject=thinking-skills returns the sections', async ({ request }) => {
    const math = await (await request.get('/api/math/heatmap')).json();
    const mathNames = math.map((e: any) => e.topicName);
    expect(mathNames).toContain('Algebra');
    expect(mathNames).not.toContain('Logical Analysis');
    expect(mathNames).not.toContain('Visual Reasoning');

    const ts = await (await request.get('/api/math/heatmap?subject=thinking-skills')).json();
    const tsNames = ts.map((e: any) => e.topicName);
    expect(tsNames).toContain('Logical Analysis');
    expect(tsNames).toContain('Visual Reasoning');
    expect(tsNames).not.toContain('Algebra');
    expect(ts.length).toBe(7);
  });

  test('the dashboard shows a Thinking Skills heatmap section', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Thinking Skills' })).toBeVisible();
    // The Mathematics section heading exists and precedes Thinking Skills.
    const body = await page.locator('main, body').first().textContent();
    expect(body!.indexOf('Mathematics')).toBeLessThan(body!.indexOf('Thinking Skills'));
  });
});
