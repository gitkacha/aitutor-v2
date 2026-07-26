import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-82: a worksheet attempt (topicId null) that the heatmap counts via its topicBreakdown must be
// reachable from the topic page's history and clickable to its detail — the exact bug found for
// Khushi/Aarsheyee. Seed such an attempt, then confirm the topic page lists it and opens the review.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'lowest-common-multiple';

test.describe('W-82 — every heatmap-counted attempt is reachable from its topic', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let attemptId = 0;

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
    const qs = await prisma.mathQuestion.findMany({ where: { topicId: topic.id }, take: 3, select: { id: true } });
    const qids = qs.map((q) => q.id);
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: admin.workspaceId, createdById: admin.id, title: 'Time Zones WS', topicIds: JSON.stringify([TOPIC_SLUG]), questions: JSON.stringify([]) },
    });
    const now = new Date();
    const attempt = await prisma.mathAttempt.create({
      data: {
        userId: student.id,
        topicId: null, // worksheet attempts have no topicId column — counted only via topicBreakdown
        source: 'worksheet',
        worksheetId: ws.id,
        questions: JSON.stringify(qids),
        answers: JSON.stringify(qids.map(() => 0)),
        topicBreakdown: JSON.stringify({ [TOPIC_SLUG]: { correct: 1, total: qids.length } }),
        score: 1,
        totalQuestions: qids.length,
        startedAt: new Date(now.getTime() - 30_000),
        finishedAt: now,
        timeTaken: 30,
      },
    });
    attemptId = attempt.id;
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('the worksheet attempt shows in the topic history and opens its review', async ({ page }) => {
    await page.goto(`/math/${TOPIC_SLUG}`);
    await expect(page.getByText('Your History')).toBeVisible();
    // The attempt is listed (was excluded before the fix) and clicking it opens the detail.
    const row = page.getByRole('button', { name: /Score:/ });
    await expect(row.first()).toBeVisible();
    await row.first().click();
    await expect(page).toHaveURL(new RegExp(`/math-attempt/${attemptId}`));
  });
});
