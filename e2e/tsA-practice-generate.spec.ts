import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';
import { startTest } from './helpers/practice';

// Phase A / A2 (W-101): a Thinking Skills section generates a fresh practice set on demand, plays it
// as a normal practice attempt, and the transient self-practice worksheet stays hidden from the
// admin Saved Worksheets list (and the student's own worksheet list).
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const tsQuestions = (n: number) => Array.from({ length: n }, (_, i) => ({
  questionText: `Self-practice visual-reasoning question ${i + 1}: which shape completes the set?`,
  options: ['The circle', 'The square', 'The triangle', 'The diamond'],
  correctIndex: 0,
  explanation: 'The pattern needs the circle. Therefore, the answer is Option A.',
  topicSlug: 'visual-reasoning', topicName: 'Visual Reasoning', skillSlug: 'visual-reasoning',
}));

function startGenStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      let reply: unknown;
      if (body.includes('independently solving')) reply = { correctIndex: 0 };
      else if (body.includes('skill tag')) reply = { skillSlug: 'visual-reasoning' };
      else reply = tsQuestions(8);
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-101 — generate-on-demand Thinking Skills practice', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startGenStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('student generates a set, runs it, reviews it — and it never shows in the worksheet lists', async ({ page, baseURL }) => {
    await page.goto('/math/visual-reasoning');
    await expect(page.getByRole('heading', { name: 'Visual Reasoning' })).toBeVisible();

    // Start Timed Practice generates on demand, then lands on the running test.
    await page.getByRole('button', { name: /Start Timed Practice/ }).click();
    await expect(page.getByRole('heading', { name: 'Ready to start?' })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/8 question/)).toBeVisible();
    await startTest(page);

    // Answer every question correctly (option A), then finish.
    await expect(page.getByText(/which shape completes the set/).first()).toBeVisible();
    for (let i = 0; i < 8; i++) {
      const optionButtons = page.locator('button', { has: page.locator('span', { hasText: /^[A-D]$/ }) });
      await optionButtons.nth(0).click();
      if (i < 7) {
        await page.getByRole('button', { name: 'Next' }).click();
      } else {
        await page.getByRole('button', { name: 'Finish Test' }).click();
        await page.getByRole('button', { name: 'Submit Now' }).click();
      }
    }

    // Review renders the generated questions and a perfect score.
    await expect(page).toHaveURL(/\/math-attempt\/\d+/);
    await expect(page.getByText('100%')).toBeVisible();
    await expect(page.getByText(/which shape completes the set/).first()).toBeVisible();

    // The self-practice worksheet exists in the DB, unassigned and marked self-practice…
    const ws = await prisma.mathWorksheet.findFirst({
      where: { title: 'Practice: Visual Reasoning', kind: 'self-practice' },
      include: { assignments: true },
    });
    expect(ws).not.toBeNull();
    expect(ws!.assignments.length).toBe(0);

    // …but it is hidden from the student's worksheet list…
    const studentList = await (await page.request.get('/api/math/worksheets')).json();
    expect(studentList.some((w: any) => w.id === ws!.id)).toBe(false);

    // …and from the admin Saved Worksheets list.
    const adminCtx = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const adminList = await (await adminCtx.get('/api/math/worksheets')).json();
    expect(adminList.some((w: any) => w.id === ws!.id)).toBe(false);
    await adminCtx.dispose();
  });

  test('a Mathematics section does not use on-demand generation (400)', async ({ page }) => {
    const res = await page.request.post('/api/math/practice/generate', { data: { topicSlug: 'arithmetic' } });
    expect(res.status()).toBe(400);
  });
});
