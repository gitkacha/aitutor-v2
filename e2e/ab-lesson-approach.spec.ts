import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-118: A/B lesson generation. The admin can generate a lesson with the opt-in "tactical" prompt;
// the module is tagged approach:"tactical", badged in the admin lessons list, and (once approved)
// renders for the student with its embedded figure.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

// Tactical (approach B) markdown: the 4-part structure + an embedded figure.
const LESSON = [
  '## 1. The Selective Trap',
  'A cyclist travels at 18 km/h. The school method makes you convert seconds to hours — too slow.',
  '',
  '```figure',
  '{"kind":"pie-chart","title":"Where the time goes","sectors":[{"label":"Ride","percent":60,"showPercent":true},{"label":"Rest","percent":40}]}',
  '```',
  '',
  '## 2. The Intuitive Building Block',
  'Think in 1-minute blocks: 18 km/h means 300 m per minute.',
  '',
  '## 3. The Speed Shortcut',
  '300 m/min → 100 m per 20s → 200 m in 40s. Mental Map: 18 km/h → 300 m/min → 200 m.',
  '',
  '## 4. Guided Drills',
  '**Scripted Hint:** picture one 20-second block. **Speed Solution:** 100 m × 2 = 200 m.',
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

async function generateTactical(admin: APIRequestContext, skillId: number): Promise<number> {
  const start = await admin.post('/api/coaching/modules/generate', { data: { skillId, approach: 'tactical' } });
  expect(start.status()).toBe(202);
  const { jobId } = await start.json();
  for (let i = 0; i < 100; i++) {
    const job = await (await admin.get(`/api/coaching/jobs/${jobId}`)).json();
    if (job.status === 'done') return job.result.moduleId;
    if (job.status === 'error') throw new Error(job.error);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('generation timed out');
}

test.describe('W-118 — tactical A/B lesson generation', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generating tactical tags the module and badges it in the admin lessons list', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });

    const moduleId = await generateTactical(admin, skill.id);
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.approach).toBe('tactical');

    const page = await ctx.newPage();
    await page.goto('/admin/lessons');
    // The freshly generated tactical lesson shows a Tactical badge in its row.
    await expect(page.getByText('Tactical').first()).toBeVisible();

    await admin.dispose();
    await ctx.close();
  });

  test('an approved tactical lesson renders for the student with its embedded figure', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });

    const moduleId = await generateTactical(admin, skill.id);
    const approve = await admin.post(`/api/coaching/modules/${moduleId}/approve`, { data: {} });
    expect(approve.status()).toBe(200);
    await admin.dispose();

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/student.json' });
    const page = await ctx.newPage();
    await page.goto(`/lesson/${moduleId}`);
    await expect(page.getByText('The Selective Trap')).toBeVisible();
    const pie = page.getByTestId('stimulus-pie-chart');
    await expect(pie).toBeVisible();
    await expect(pie.locator('svg')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w118-tactical-lesson.png', fullPage: true });
    await ctx.close();
  });
});
