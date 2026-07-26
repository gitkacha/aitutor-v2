import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-83: admins can delete UNATTEMPTED worksheets; a worksheet with any attempt is refused (409) so
// deletion can never orphan an attempt. Math and writing.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-83 — delete unattempted worksheets', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('admin deletes an unattempted worksheet from the Admin page', async ({ page }) => {
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'UI Delete WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });
    page.on('dialog', (d) => d.accept()); // confirm()

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    // The saved-worksheet row is the one carrying a Delete button (excludes the sidebar/pending rows).
    const row = page.locator('div.p-3')
      .filter({ hasText: 'UI Delete WS' })
      .filter({ has: page.getByRole('button', { name: 'Delete' }) });
    await expect(row).toBeVisible();
    await row.getByRole('button', { name: 'Delete' }).click();
    await expect(row).toHaveCount(0);
  });

  test('math: an unattempted worksheet is deleted; an attempted one is refused (409)', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

    // Unattempted → deletable.
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Deletable Math WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });
    const del = await admin.delete(`/api/math/worksheets/${ws.id}`);
    expect(del.status(), 'unattempted worksheet deletes').toBe(200);
    expect(await prisma.mathWorksheet.findUnique({ where: { id: ws.id } })).toBeNull();

    // Attempted → refused (409), still present.
    const ws2 = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Attempted Math WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });
    const now = new Date();
    await prisma.mathAttempt.create({
      data: {
        userId: student.id, topicId: null, source: 'worksheet', worksheetId: ws2.id,
        questions: JSON.stringify([]), answers: JSON.stringify([]), topicBreakdown: JSON.stringify({}),
        score: 0, totalQuestions: 0, startedAt: new Date(now.getTime() - 1000), finishedAt: now, timeTaken: 1,
      },
    });
    const del2 = await admin.delete(`/api/math/worksheets/${ws2.id}`);
    expect(del2.status(), 'attempted worksheet is refused').toBe(409);
    expect(await prisma.mathWorksheet.findUnique({ where: { id: ws2.id } }), 'still present').not.toBeNull();

    await admin.dispose();
  });

  test('writing: an unattempted worksheet is deleted', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const type = await prisma.writingType.findFirstOrThrow();
    const ws = await prisma.worksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Deletable Writing WS', typeId: type.id, prompts: JSON.stringify(['Write about your day.']) },
    });
    const del = await admin.delete(`/api/worksheets/${ws.id}`);
    expect(del.status()).toBe(200);
    expect(await prisma.worksheet.findUnique({ where: { id: ws.id } })).toBeNull();
    await admin.dispose();
  });
});
