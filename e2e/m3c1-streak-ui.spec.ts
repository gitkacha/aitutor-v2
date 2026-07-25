import { test, expect } from '@playwright/test';

// M3c-1 Task 5: the weekly-goal streak indicator in the sidebar. Reuses Task 3's
// (e2e/m3c1-streak.spec.ts) submission approach — >=5 non-demo math attempts in the current
// week and >=5 in the prior week yields a streakWeeks >= 2 from GET /api/stats — but here we
// assert the sidebar surfaces it on /dashboard for the default e2e student.
//
// Timestamps are pinned to a safe mid-week instant (Thursday noon) for the current week and
// exactly 7 days earlier for the prior week, rather than "now"-relative offsets, so the two
// batches can never straddle a Sunday/Monday week boundary and flake.
test.describe('weekly streak (sidebar)', () => {
  test('shows a >=2-week streak in the sidebar after 5+ sessions this week and last week', async ({ page, request }) => {
    const questions = await (await request.get('/api/math/questions?topic=arithmetic')).json();
    expect(questions.length).toBeGreaterThanOrEqual(1);
    const q = questions[0];

    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const midCurrent = new Date(monday.getTime() + 3 * 86_400_000 + 12 * 3_600_000); // Thu noon this week
    const midPrior = new Date(midCurrent.getTime() - 7 * 86_400_000); // Thu noon prior week

    const submitAttempt = async (finishedAt: Date, offsetMs: number) => {
      const at = new Date(finishedAt.getTime() + offsetMs);
      const startedAt = new Date(at.getTime() - 30_000);
      const res = await request.post('/api/math/attempts', {
        data: {
          topicId: q.topicId,
          questions: JSON.stringify([q.id]),
          answers: JSON.stringify([0]),
          startedAt: startedAt.toISOString(),
          finishedAt: at.toISOString(),
          timeTaken: 30,
          source: 'practice',
        },
      });
      expect(res.status()).toBe(201);
    };

    for (let i = 0; i < 5; i++) await submitAttempt(midCurrent, i * 60_000);
    for (let i = 0; i < 5; i++) await submitAttempt(midPrior, i * 60_000);

    await page.goto('/dashboard');
    const streak = page.getByTestId('weekly-streak');
    // The element renders immediately (initial state shows the "Hit 5…" copy) and only
    // reflects the real streak once GET /api/stats resolves, so assert on text content with
    // Playwright's auto-retrying matcher rather than a one-shot textContent() read.
    await expect(streak).toContainText(/\d+-week streak/);
    const text = await streak.textContent();
    const n = parseInt(text!.match(/(\d+)-week streak/)![1], 10);
    expect(n).toBeGreaterThanOrEqual(2);
  });
});
