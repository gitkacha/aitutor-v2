import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-92 (Thinking Skills, Task 4): the novel fold-cut and target figures render. The seeded
// visual-reasoning exemplars carry a `target` and a `fold-cut` stimulus; a student's attempt review
// must render both.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-92 — fold-cut + target figures render', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('the visual-reasoning exemplars render their target and fold-cut figures', async ({ page, request }) => {
    const topic = await prisma.mathTopic.findFirstOrThrow({ where: { slug: 'visual-reasoning' } });
    const qs = await prisma.mathQuestion.findMany({ where: { topicId: topic.id, worksheetId: null }, select: { id: true } });
    const qIds = qs.map((q) => q.id);
    expect(qIds.length).toBeGreaterThanOrEqual(2);

    const created = await request.post('/api/math/attempts', {
      data: {
        topicId: topic.id,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(qIds.map(() => 0)),
        startedAt: new Date(Date.now() - 60_000).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: 60,
        source: 'practice',
      },
    });
    expect(created.status()).toBe(201);
    const attempt = await created.json();

    await page.goto(`/math-attempt/${attempt.id}`);
    await expect(page.getByTestId('stimulus-target').first()).toBeVisible();
    await expect(page.getByTestId('stimulus-fold-cut').first()).toBeVisible();
  });
});
