import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-95 (Thinking Skills, Task 7): the Admin UI generate flow — select a section, generate (4-option
// TS questions incl. a target figure), review, save unassigned, then assign from the saved list.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const tsQuestions = (n: number) => Array.from({ length: n }, (_, i) => ({
  questionText: `Admin TS logical-analysis question ${i + 1}: which is forced by the clues?`,
  options: ['Statement A', 'Statement B', 'Statement C', 'None of the above'],
  correctIndex: 0,
  explanation: 'Only the first is forced. Therefore, the answer is Option A.',
  topicSlug: 'logical-analysis', topicName: 'Logical Analysis', skillSlug: 'logical-analysis',
}));

function startGenStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let reply: unknown;
      if (body.includes('independently solving')) reply = { correctIndex: 0 };
      else if (body.includes('skill tag')) reply = { skillSlug: 'logical-analysis' };
      else reply = tsQuestions(5);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-95 — Admin Thinking Skills generate flow', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startGenStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generate → review → save unassigned → assign to a student', async ({ page, baseURL }) => {
    await page.goto('/admin');
    const card = page.getByTestId('ts-generate');
    await expect(card).toBeVisible();
    await card.getByRole('button', { name: 'Logical Analysis' }).click();
    await card.getByLabel('Number of questions').fill('5'); // match the stub's batch of 5
    await card.getByRole('button', { name: /Generate .*Question/ }).click();

    // Review shows the generated questions.
    await expect(card.getByRole('heading', { name: /Review Generated Questions/ })).toBeVisible({ timeout: 15000 });
    await expect(card.getByText(/which is forced by the clues/).first()).toBeVisible();
    await card.getByRole('button', { name: 'Save Worksheet' }).click();
    await expect(card.getByText(/Saved "Thinking Skills: Logical Analysis"/)).toBeVisible();

    // The saved worksheet exists, is unassigned, over a thinking-skills topic, and 4-option.
    const ws = await prisma.mathWorksheet.findFirst({ where: { title: 'Thinking Skills: Logical Analysis' }, include: { questionRows: { include: { topic: true } }, assignments: true } });
    expect(ws).not.toBeNull();
    expect(ws!.assignments.length).toBe(0);
    expect(ws!.questionRows.every((q) => q.topic.subject === 'thinking-skills')).toBe(true);
    expect(JSON.parse(ws!.questionRows[0].options).length).toBe(4);

    // Assign it via the API (the Saved Worksheets Assign control is W-85, e2e-covered elsewhere).
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const assign = await page.request.post(`/api/math/worksheets/${ws!.id}/assign`, { data: { studentIds: [student.id] } });
    expect(assign.status()).toBe(200);
    const studentCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });
    const list = await (await studentCtx.get('/api/math/worksheets')).json();
    expect(list.some((w: any) => w.id === ws!.id)).toBe(true);
    await studentCtx.dispose();
  });
});
