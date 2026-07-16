import { test, expect } from '@playwright/test';

// The math score-history page (/math-history/:slug) hung on a spinner forever for
// every topic: the route param is named topicSlug but ScoreHistory read typeSlug,
// so it never fetched anything. Also: topic detail must not count worksheet
// questions as part of the topic's practice bank.

test.describe('math score history', () => {
  test('renders history (not an endless spinner) and lists a real attempt', async ({ page, request }) => {
    // Create one real arithmetic attempt via the API so history has data.
    const questions = await (await request.get('/api/math/questions?topic=arithmetic')).json();
    const qIds = questions.slice(0, 2).map((q: any) => q.id);
    const now = Date.now();
    const created = await request.post('/api/math/attempts', {
      data: {
        topicId: questions[0].topicId,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(qIds.map((_: any, i: number) => questions[i].correctIndex)),
        startedAt: new Date(now - 120_000).toISOString(),
        finishedAt: new Date(now).toISOString(),
        timeTaken: 120,
        source: 'practice',
      },
    });
    expect(created.status()).toBe(201);

    await page.goto('/math-history/arithmetic');
    await expect(page.getByRole('heading', { name: /Arithmetic.*Score History/ })).toBeVisible();
    await expect(page.getByText(/Score: 2\/2/)).toBeVisible();
    await expect(page.locator('.animate-spin')).toHaveCount(0);
  });

  test('a topic with no attempts shows the empty state, not a spinner', async ({ page }) => {
    await page.goto('/math-history/rotation');
    await expect(page.getByText('No completed attempts with scores yet for this topic.')).toBeVisible();
  });

  test('topic detail excludes worksheet questions from the topic bank', async ({ request }) => {
    const save = await request.post('/api/math/worksheets/save', {
      data: {
        title: `E2E Topic Leak ${Date.now()}`,
        topicIds: ['fractions'],
        questions: [
          { questionText: 'What is 1/2 + 1/4?', options: ['1/4', '2/4', '3/4', '4/4', '5/4'], correctIndex: 2, explanation: '3/4.', topicSlug: 'fractions', topicName: 'Fractions' },
        ],
      },
    });
    expect(save.status()).toBe(201);

    const topic = await (await request.get('/api/math/topics/fractions')).json();
    for (const q of topic.questions) {
      expect(q.worksheetId, 'worksheet questions must not appear in the topic bank').toBeNull();
    }
  });
});
