import { test, expect } from '@playwright/test';

// Phase A / A3 (W-102): the sidebar Thinking Skills section shows per-section score badges (and a
// collapsed strip of tiles), mirroring Mathematics. Phase 1 deferred these.
test.describe('W-102 — sidebar Thinking Skills scores', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });

  test('a scored Thinking Skills attempt shows a % badge in the sidebar', async ({ page }) => {
    // Record a practice attempt on a Thinking Skills section so its heatmap score is non-null.
    const questions = await (await page.request.get('/api/math/questions?topic=visual-reasoning')).json();
    expect(Array.isArray(questions) && questions.length).toBeTruthy();
    const ids = questions.map((q: any) => q.id);
    const topicId = questions[0].topicId;
    const now = new Date();
    const res = await page.request.post('/api/math/attempts', {
      data: {
        topicId,
        questions: JSON.stringify(ids),
        answers: JSON.stringify(ids.map(() => 0)),
        startedAt: new Date(now.getTime() - 60000).toISOString(),
        finishedAt: now.toISOString(),
        timeTaken: 60,
        source: 'practice',
      },
    });
    expect(res.status()).toBe(201);

    await page.goto('/dashboard');
    const nav = page.locator('aside').first();
    await nav.getByRole('button', { name: /Thinking Skills/ }).click();
    const link = nav.getByRole('link', { name: 'Visual Reasoning' });
    await expect(link).toBeVisible();
    // The badge renders a percentage next to the section name.
    await expect(link).toContainText(/\d+%/);
  });
});
