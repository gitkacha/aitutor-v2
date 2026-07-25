import { test, expect } from '@playwright/test';

// M3c-1 Task 3: the weekly-goal practice streak. Submitting >=5 non-demo attempts in the
// current week and >=5 in the prior week should produce streakWeeks >= 2 from GET /api/stats
// (>=2 rather than an exact value: other specs' attempts only ever help the count, never hurt
// the streak, so the assertion stays robust to test order).
test.describe('weekly-goal streak (GET /api/stats)', () => {
  test('submitting 5+ sessions in the current week and prior week yields a streak of at least 2', async ({ request }) => {
    const questions = await (await request.get('/api/math/questions?topic=arithmetic')).json();
    expect(questions.length).toBeGreaterThanOrEqual(1);
    const q = questions[0];

    const submitAttempt = async (finishedAt: Date) => {
      const startedAt = new Date(finishedAt.getTime() - 30_000);
      const res = await request.post('/api/math/attempts', {
        data: {
          topicId: q.topicId,
          questions: JSON.stringify([q.id]),
          answers: JSON.stringify([0]),
          startedAt: startedAt.toISOString(),
          finishedAt: finishedAt.toISOString(),
          timeTaken: 30,
          source: 'practice',
        },
      });
      expect(res.status()).toBe(201);
    };

    const now = Date.now();
    const currentWeekTimes = Array.from({ length: 5 }, (_, i) => new Date(now - i * 60_000));
    const priorWeekTimes = Array.from({ length: 5 }, (_, i) => new Date(now - 7 * 86_400_000 - i * 60_000));

    for (const t of [...currentWeekTimes, ...priorWeekTimes]) {
      await submitAttempt(t);
    }

    const stats = await (await request.get('/api/stats')).json();
    expect(stats.streakWeeks).toBeGreaterThanOrEqual(2);
  });
});
