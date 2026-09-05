import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// Phase C / C4 (W-113): the full loop — an admin generates and approves a Thinking Skills lesson,
// then the student sees it on that section's practice page and opens it. Closes TS parity.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;
const MARKER = 'Forced-conclusion trick you can show off';
const LESSON = `## The idea
${MARKER}.

## Step by step
Check every clue in turn.

## Worked examples
A before B, B before C, so A before C.

## Traps to avoid
Never accept a merely-possible option.`;

function startStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: LESSON } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.describe('W-113 — Thinking Skills coaching loop reaches the student', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generate → approve a TS lesson → the student sees and opens it on the section page', async ({ page, baseURL }) => {
    const skill = await prisma.skill.findFirstOrThrow({ where: { slug: 'finding-procedures', subject: 'thinking-skills' } });
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });

    // Admin generates the lesson (model stubbed) …
    const start = await admin.post('/api/coaching/modules/generate', { data: { skillId: skill.id } });
    expect(start.status()).toBe(202);
    const { jobId } = await start.json();
    let moduleId = 0;
    for (let i = 0; i < 100; i++) {
      const job = await (await admin.get(`/api/coaching/jobs/${jobId}`)).json();
      if (job.status === 'done') { moduleId = job.result.moduleId; break; }
      if (job.status === 'error') throw new Error(job.error);
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(moduleId).toBeGreaterThan(0);

    // … and approves it.
    const approve = await admin.post(`/api/coaching/modules/${moduleId}/approve`, { data: {} });
    expect(approve.status()).toBe(200);
    await admin.dispose();

    // The student sees it on the Finding Procedures section page and opens it.
    await page.goto('/math/finding-procedures');
    const lessons = page.getByTestId('topic-lessons');
    await expect(lessons).toBeVisible();
    await lessons.getByRole('link', { name: /Finding Procedures/ }).first().click();
    await expect(page).toHaveURL(/\/lesson\/\d+/);
    await expect(page.getByText(MARKER).first()).toBeVisible();
  });
});
