import { test, expect } from '@playwright/test';

// Phase A / A4 (W-103): a weak Thinking Skills section must surface in the Dashboard Opportunity
// Areas panel (alongside Writing and Mathematics), linking to its /math/<slug> practice page.
test.describe('W-103 — Opportunity Areas include Thinking Skills', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });

  test('a weak Thinking Skills section appears in Opportunity Areas and links to practice', async ({ page }) => {
    // Record a 0% attempt on a Thinking Skills section (answers -1 → guaranteed weakest overall).
    const questions = await (await page.request.get('/api/math/questions?topic=relevant-selection')).json();
    expect(Array.isArray(questions) && questions.length).toBeTruthy();
    const ids = questions.map((q: any) => q.id);
    const now = new Date();
    const res = await page.request.post('/api/math/attempts', {
      data: {
        topicId: questions[0].topicId,
        questions: JSON.stringify(ids),
        answers: JSON.stringify(ids.map(() => -1)),
        startedAt: new Date(now.getTime() - 60000).toISOString(),
        finishedAt: now.toISOString(),
        timeTaken: 60,
        source: 'practice',
      },
    });
    expect(res.status()).toBe(201);

    await page.goto('/dashboard');
    const panel = page.locator('section', { has: page.getByRole('heading', { name: 'Opportunity Areas' }) });
    await expect(panel).toBeVisible();
    const item = panel.getByRole('button', { name: /Relevant Selection/ });
    await expect(item).toBeVisible();
    await expect(item).toContainText('Current average: 0%');

    await item.click();
    await expect(page).toHaveURL(/\/math\/relevant-selection/);
  });
});
