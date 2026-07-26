import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-74: an assigned, incomplete lesson appears as a "Learn:" card in the student's pending list,
// ahead of the practice worksheets (learn → practise ordering), and links to the lesson.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const TITLE = 'Assigned See-Saw Lesson';

test.describe('W-74 — learn → practise ordering', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let moduleId = 0;

  test.beforeAll(async () => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });
    const mod = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skill.id, title: TITLE, content: '## The idea\nBalance.', status: 'approved' },
    });
    moduleId = mod.id;
    // An incomplete assignment for this student.
    await prisma.coachingAssignment.upsert({
      where: { moduleId_studentId: { moduleId: mod.id, studentId: student.id } },
      update: { completedAt: null },
      create: { moduleId: mod.id, studentId: student.id },
    });
  });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('an assigned lesson shows as a Learn card in the pending list and opens the lesson', async ({ page }) => {
    await page.goto('/dashboard');
    const learn = page.getByText(`Learn: ${TITLE}`);
    await expect(learn).toBeVisible();
    await learn.click();
    await expect(page).toHaveURL(new RegExp(`/lesson/${moduleId}`));
  });

  test('the worksheet paired to an incomplete lesson (same interventionId) shows a "best after the lesson" hint', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });

    const mod = await prisma.coachingModule.create({
      data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Paired Lesson', content: '## The idea\nx', status: 'approved' },
    });
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: admin.workspaceId, createdById: admin.id, title: 'Paired Practice WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });
    await prisma.mathWorksheetAssignment.create({ data: { worksheetId: ws.id, studentId: student.id } });
    const iv = await prisma.intervention.create({
      data: {
        workspaceId: admin.workspaceId, studentId: student.id, createdById: admin.id,
        skillSlugs: JSON.stringify([skill.slug]), diagnosisSnapshot: '{}', recommendation: 'r', rationale: 'y',
        worksheetIds: JSON.stringify({ math: [ws.id] }), coachingModuleIds: JSON.stringify([mod.id]), status: 'active',
      },
    });
    await prisma.coachingAssignment.create({ data: { moduleId: mod.id, studentId: student.id, interventionId: iv.id } });

    await page.goto('/dashboard');
    // The specific paired worksheet carries the soft hint; it is still startable (never locked).
    // Narrow to the pending-list card (the sidebar "Up next" also lists it but has no hint).
    const card = page.locator('div.p-3').filter({ hasText: 'Paired Practice WS' }).filter({ hasText: 'best after the lesson' });
    await expect(card.getByText(/best after the lesson/i)).toBeVisible();
    await expect(card.getByRole('button', { name: 'Start' })).toBeEnabled();
  });
});
