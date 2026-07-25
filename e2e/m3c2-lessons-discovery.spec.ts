import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-79: generated coaching lessons must be easy to find after generation — via the admin Lessons
// index (/admin/lessons) and a "Your lessons" summary atop the Skills page. Seed a draft + an
// approved module directly, then assert both surfaces list them and link to the editor.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const DRAFT_TITLE = 'Discovery Draft Lesson';
const APPROVED_TITLE = 'Discovery Approved Lesson';

test.describe('W-79 — coaching lessons are discoverable', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  let draftId = 0;

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const skills = await prisma.skill.findMany({ where: { subject: 'math', topicId: { not: null } }, take: 2 });
    const draft = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skills[0].id, title: DRAFT_TITLE, content: '## The idea\nDraft content.', status: 'draft' },
    });
    draftId = draft.id;
    await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skills[1].id, title: APPROVED_TITLE, content: '## The idea\nApproved content.', status: 'approved' },
    });
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('the admin Lessons index lists modules with status and links to the editor', async ({ page }) => {
    await page.goto('/admin/lessons');
    await expect(page.getByRole('heading', { name: 'Lessons' })).toBeVisible();
    await expect(page.getByText(DRAFT_TITLE)).toBeVisible();
    await expect(page.getByText(APPROVED_TITLE)).toBeVisible();

    // Clicking a lesson opens its editor.
    await page.getByText(DRAFT_TITLE).click();
    await expect(page).toHaveURL(new RegExp(`/admin/modules/${draftId}`));
  });

  test('the Skills page surfaces a "Your lessons" summary', async ({ page }) => {
    await page.goto('/skills');
    await expect(page.getByTestId('your-lessons')).toBeVisible();
    await expect(page.getByTestId('your-lessons').getByText(DRAFT_TITLE)).toBeVisible();
    await expect(page.getByTestId('your-lessons').getByText(APPROVED_TITLE)).toBeVisible();
  });
});
