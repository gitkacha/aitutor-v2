import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-72: the student Lessons library lists every approved lesson (grouped by topic) and opens each.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TITLE = 'Library See-Saw Lesson';

test.describe('W-72 — student Lessons library', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let moduleId = 0;

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });
    const mod = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skill.id, title: TITLE, content: '## The idea\nBalance both sides.', status: 'approved' },
    });
    moduleId = mod.id;
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('the student reaches the library from the sidebar and opens a lesson', async ({ page }) => {
    await page.goto('/dashboard');
    // Sidebar nav link (students only).
    await page.getByRole('link', { name: 'Lessons' }).click();
    await expect(page).toHaveURL(/\/lessons$/);
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();

    const row = page.getByText(TITLE);
    await expect(row).toBeVisible();
    await row.click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${moduleId}`));
    await expect(page.getByRole('heading', { name: 'The idea' })).toBeVisible();
  });
});
