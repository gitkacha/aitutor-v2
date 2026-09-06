import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-116: a coaching lesson can embed a REAL figure. The model (stubbed) returns lesson markdown
// containing a ```figure pie-chart block; after an admin generates + approves it, the student opens
// the lesson and sees an actual pie chart — not the raw JSON.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

// The lesson body carries a fenced ```figure block (one figure JSON object) in "The idea" and
// reuses the concept in a worked example.
const LESSON = [
  '## The idea',
  'These questions show a whole split into parts. Look at the biggest slice first.',
  '',
  '```figure',
  '{"kind":"pie-chart","title":"Where Sam\'s money goes","sectors":[{"label":"Rent","percent":50,"showPercent":true},{"label":"Food","percent":30},{"label":"Fun","percent":20}]}',
  '```',
  '',
  '## Step by step',
  'Rent is half the circle, so it is 50%.',
  '',
  '## Worked examples',
  'Half of $20 is $10, so Sam spends $10 on rent.',
  '',
  '## Traps to avoid',
  'Do not add the percentages of two slices twice.',
].join('\n');

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

test.describe('W-116 — coaching lessons render real embedded figures', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generate + approve a lesson with a ```figure block → student sees a real chart, not JSON', async ({ page, baseURL }) => {
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });
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

    // The student opens the lesson and sees a rendered pie chart, not the raw figure JSON.
    await page.goto(`/lesson/${moduleId}`);
    const pie = page.getByTestId('stimulus-pie-chart');
    await expect(pie).toBeVisible();
    await expect(page.getByText("Where Sam's money goes")).toBeVisible();
    await expect(pie.locator('svg')).toBeVisible();
    // The raw JSON must not leak into the page as text.
    const bodyText = (await page.locator('body').textContent()) ?? '';
    expect(bodyText).not.toContain('"kind"');
    expect(bodyText).not.toContain('sectors');

    await page.screenshot({ path: 'docs/screenshots/w116-visual-lesson.png', fullPage: true });
  });
});
