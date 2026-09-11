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
  '## 4. Guided Quiz',
  '```quiz',
  '{"question":"How many metres in 40 seconds?","hint":"Find the 1-minute block first: [___] m per minute, then take [___] of it.","answer":"200","acceptable":["200 m"],"solution":"One 20s block is 100 m, so REVEALSOLUTION 100 times 2 = 200 m."}',
  '```',
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

async function generateLesson(admin: APIRequestContext, skillId: number): Promise<number> {
  const start = await admin.post('/api/coaching/modules/generate', { data: { skillId } });
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

test.describe('lesson generation (tactical, single approach — W-123)', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('the Skills page offers a single "Generate lesson" action (no Standard/Tactical choice)', async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto('/skills');
    await expect(page.getByRole('button', { name: 'Generate lesson' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Standard', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tactical', exact: true })).toHaveCount(0);
    await ctx.close();
  });

  test('generating tags the module tactical (approach column retained)', async ({ baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });
    const moduleId = await generateLesson(admin, skill.id);
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.approach).toBe('tactical');
    await admin.dispose();
  });

  test('the editor Regenerate creates a new draft and keeps the original (W-119)', async ({ browser, baseURL }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });

    const firstId = await generateLesson(admin, skill.id);
    const before = await prisma.coachingModule.count({ where: { skillId: skill.id } });

    const page = await ctx.newPage();
    await page.goto(`/admin/modules/${firstId}`);
    // Single "Regenerate" button — no "Regenerate as Standard/Tactical".
    await expect(page.getByRole('button', { name: 'Regenerate as Standard' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Regenerate as Tactical' })).toHaveCount(0);
    const regen = page.getByRole('button', { name: 'Regenerate', exact: true });
    await expect(regen).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w123-editor-regenerate.png' });
    await regen.click();

    // Lands on a NEW module editor (different id); the original still exists.
    await expect(page).toHaveURL(new RegExp(`/admin/modules/(?!${firstId})\\d+`), { timeout: 20000 });
    const after = await prisma.coachingModule.count({ where: { skillId: skill.id } });
    expect(after).toBe(before + 1);
    expect(await prisma.coachingModule.findUnique({ where: { id: firstId } })).not.toBeNull();

    await admin.dispose();
    await ctx.close();
  });

  test('an approved lesson renders for the student with its embedded figure', async ({ browser, baseURL }) => {
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });

    const moduleId = await generateLesson(admin, skill.id);
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

    // W-120: the Guided Quiz is interactive — the worked solution is hidden until answered.
    const quiz = page.locator('div', { has: page.getByText('How many metres in 40 seconds?') }).last();
    await expect(page.getByText('How many metres in 40 seconds?')).toBeVisible();
    await expect(page.getByText(/REVEALSOLUTION/)).toHaveCount(0);
    await quiz.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/screenshots/w120-quiz-before.png' });
    await page.getByLabel('Your answer').first().fill('200');
    await page.getByRole('button', { name: 'Check' }).first().click();
    await expect(page.getByText(/Nice — that's it/)).toBeVisible();
    await expect(page.getByText(/REVEALSOLUTION/)).toBeVisible();
    await quiz.scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'docs/screenshots/w120-quiz-after.png' });
    await ctx.close();
  });
});
