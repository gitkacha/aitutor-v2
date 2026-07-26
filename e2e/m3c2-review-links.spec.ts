import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-75: in post-test review, a wrong answer whose skill has an approved lesson shows a
// "Learn the method →" link to that lesson (and a skill chip). Uses a topic no other spec tags.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TOPIC_SLUG = 'patterns';

test.describe('W-75 — post-test review "Learn the method" links', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('a missed question with an approved lesson shows the Learn link', async ({ page, baseURL }) => {
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { slug: TOPIC_SLUG } });
    const question = await prisma.mathQuestion.findFirstOrThrow({ where: { topicId: topic.id } });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: topic.id } });
    await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });

    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const mod = await prisma.coachingModule.create({
      data: { workspaceId: adminUser.workspaceId, skillId: skill.id, title: 'Patterns Method', content: '## The idea\nSpot the rule.', status: 'approved' },
    });

    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    // Answer key from admin; the student answers wrong.
    const bank = await (await admin.get(`/api/math/questions?topic=${TOPIC_SLUG}`)).json();
    const correctIndex: number = bank.find((q: any) => q.id === question.id).correctIndex;
    const wrongIndex = (correctIndex + 1) % 5;

    const finishedAt = new Date();
    const created = await student.post('/api/math/attempts', {
      data: {
        topicId: topic.id,
        questions: JSON.stringify([question.id]),
        answers: JSON.stringify([wrongIndex]),
        startedAt: new Date(finishedAt.getTime() - 30_000).toISOString(),
        finishedAt: finishedAt.toISOString(),
        timeTaken: 30,
        source: 'practice',
      },
    });
    expect(created.status()).toBe(201);
    const attemptId = (await created.json()).id;
    await admin.dispose();
    await student.dispose();

    // The review page shows the skill chip and a Learn link that opens the lesson.
    await page.goto(`/math-attempt/${attemptId}`);
    await expect(page.getByText(skill.name).first()).toBeVisible();
    const learn = page.getByRole('link', { name: /Learn the method/i });
    await expect(learn).toBeVisible();
    await learn.click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${mod.id}`));
  });
});
