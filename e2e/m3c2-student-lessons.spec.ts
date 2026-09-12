import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-70/W-73/W-80: an approved lesson must be discoverable by the student under its topic (on the
// topic practice page), openable, readable, and completable. Seed one approved module for a skill
// that belongs to a topic, then walk the student through it.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const LESSON_TITLE = 'Balancing the See-Saw';
const LESSON_MD = [
  '## The idea',
  'A number sentence is a see-saw — keep both sides equal.',
  '',
  '## Step by step',
  '1. Cover the missing number.',
  '2. Find the target.',
  '',
  '## Speed technique',
  'Work backwards from the total.',
  '',
  '## Worked examples',
  '7 + 5 = 12.',
  '',
  '## Traps to avoid',
  "- Don't do the same operation instead of the opposite.",
  '- Forgetting to check both sides.',
].join('\n');

test.describe('W-70/W-73/W-80 — student sees lessons under the topic', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let moduleId = 0;
  let topicSlug = '';

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    // A math skill that belongs to a topic.
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });
    const topic = await prisma.mathTopic.findUniqueOrThrow({ where: { id: skill.topicId! } });
    topicSlug = topic.slug;
    const mod = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skill.id, title: LESSON_TITLE, content: LESSON_MD, status: 'approved' },
    });
    moduleId = mod.id;
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('the lesson appears under its topic, opens, renders and can be completed', async ({ page }) => {
    await page.goto(`/math/${topicSlug}`);

    // A lessons section on the topic page shows the approved lesson.
    const lessons = page.getByTestId('topic-lessons');
    await expect(lessons).toBeVisible();
    await expect(lessons.getByText(LESSON_TITLE)).toBeVisible();

    // Open it → the segmented player shows one section per card (W-124).
    await lessons.getByText(LESSON_TITLE).click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${moduleId}`));
    await expect(page.getByRole('heading', { name: 'The idea' })).toBeVisible();

    // Step to the Speed technique card — it keeps its green "Show-off move" treatment.
    await page.getByRole('button', { name: 'Next' }).click(); // Step by step
    await page.getByRole('button', { name: 'Next' }).click(); // Speed technique
    await expect(page.getByRole('heading', { name: 'Speed technique' })).toBeVisible();
    await expect(page.getByText('Show-off move')).toBeVisible();

    // Step to the last card (Traps to avoid). No quiz → completion is available immediately.
    await page.getByRole('button', { name: 'Next' }).click(); // Worked examples
    await page.getByRole('button', { name: 'Next' }).click(); // Traps to avoid
    await expect(page.getByRole('heading', { name: 'Traps to avoid' })).toBeVisible();
    await page.getByRole('button', { name: 'Mark complete' }).click();
    await expect(page.getByText(/Lesson complete|Completed/i).first()).toBeVisible();
  });

  test('a student never receives a draft lesson (404)', async ({ page, request }) => {
    // Draft module in the same workspace must 404 for the student.
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });
    const draft = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Hidden Draft', content: '## x', status: 'draft' },
    });
    expect((await request.get(`/api/coaching/modules/${draft.id}`)).status()).toBe(404);
  });
});
