import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-85 Part B: an admin can assign an already-saved worksheet to one or more students (the chat now
// saves worksheets unassigned; assignment happens from the Admin UI). After assigning, the student
// sees it in their worksheet list.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-85 Part B — assign a saved worksheet', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('math: assigning a saved worksheet makes it visible to the student', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });

    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Assignable Math WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });

    // Not assigned yet → student can't see it.
    const before = await (await studentCtx.get('/api/math/worksheets')).json();
    expect(before.some((w: any) => w.id === ws.id)).toBe(false);

    const assign = await admin.post(`/api/math/worksheets/${ws.id}/assign`, { data: { studentIds: [student.id] } });
    expect(assign.status()).toBe(200);

    // Idempotent — assigning again doesn't error or duplicate.
    expect((await admin.post(`/api/math/worksheets/${ws.id}/assign`, { data: { studentIds: [student.id] } })).status()).toBe(200);
    expect(await prisma.mathWorksheetAssignment.count({ where: { worksheetId: ws.id, studentId: student.id } })).toBe(1);

    const after = await (await studentCtx.get('/api/math/worksheets')).json();
    expect(after.some((w: any) => w.id === ws.id), 'student now sees the assigned worksheet').toBe(true);

    await admin.dispose();
    await studentCtx.dispose();
  });

  test('writing: assigning a saved worksheet makes it visible to the student', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const type = await prisma.writingType.findFirstOrThrow();

    const ws = await prisma.worksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'Assignable Writing WS', typeId: type.id, prompts: JSON.stringify(['Write about a hero.']) },
    });
    const assign = await admin.post(`/api/worksheets/${ws.id}/assign`, { data: { studentIds: [student.id] } });
    expect(assign.status()).toBe(200);
    const after = await (await studentCtx.get('/api/worksheets')).json();
    expect(after.some((w: any) => w.id === ws.id)).toBe(true);

    await admin.dispose();
    await studentCtx.dispose();
  });
});

test.describe('W-85 Part B — assign from the Admin page (UI)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('admin assigns a saved worksheet to a student via the Admin UI', async ({ page, baseURL }) => {
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'UI Assign WS', topicIds: JSON.stringify(['patterns']), questions: JSON.stringify([]) },
    });

    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    const row = page.locator('div.p-3').filter({ hasText: 'UI Assign WS' }).filter({ has: page.getByRole('button', { name: 'Assign', exact: true }) });
    await row.getByRole('button', { name: 'Assign', exact: true }).click();
    // The assign panel appears with a student checklist.
    await row.locator('label').filter({ hasText: 'E2E Student' }).getByRole('checkbox').check();
    await row.getByRole('button', { name: /^Assign 1/ }).click();
    await expect(page.getByText(/Assigned to 1 student/)).toBeVisible();

    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const list = await (await studentCtx.get('/api/math/worksheets')).json();
    expect(list.some((w: any) => w.id === ws.id)).toBe(true);
    await studentCtx.dispose();
  });
});
