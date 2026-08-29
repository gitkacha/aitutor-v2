import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-99: a Thinking Skills worksheet in the admin Pending list is labelled "Thinking Skills" (not
// "Mathematics") and can be assigned to students from there.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-99 — Thinking Skills pending label + assign', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('payload carries subject; pending row is labelled Thinking Skills and is assignable', async ({ page, request, baseURL }) => {
    const adminUser = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
    const ws = await prisma.mathWorksheet.create({
      data: { workspaceId: adminUser.workspaceId, createdById: adminUser.id, title: 'TS Pending WS', topicIds: JSON.stringify(['logical-analysis']), questions: JSON.stringify([{ questionText: 'Q', options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'e' }]) },
    });

    // The list payload marks it as thinking-skills.
    const list = await (await request.get('/api/math/worksheets')).json();
    const row = list.find((w: any) => w.id === ws.id);
    expect(row.subject).toBe('thinking-skills');

    // In the admin Pending list, the row is labelled "Thinking Skills" and has an Assign control.
    await page.goto('/admin');
    const pending = page.getByTestId('pending-worksheets');
    const card = pending.locator('div.rounded-lg').filter({ hasText: 'TS Pending WS' }).filter({ has: page.getByRole('button', { name: 'Assign' }) });
    await expect(card.getByText(/Thinking Skills ·/)).toBeVisible();

    await card.getByRole('button', { name: 'Assign' }).click();
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    await card.getByRole('checkbox').first().check();
    await card.getByRole('button', { name: /^Assign \d/ }).click();
    // On success the assign panel closes.
    await expect(card.getByText('Assign to students')).toBeHidden();

    // The student is now assigned.
    expect(await prisma.mathWorksheetAssignment.count({ where: { worksheetId: ws.id, studentId: student.id } })).toBe(1);

    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const sList = await (await studentCtx.get('/api/math/worksheets')).json();
    expect(sList.some((w: any) => w.id === ws.id)).toBe(true);
    await studentCtx.dispose();
  });
});
