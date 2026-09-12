import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-128/W-129: an admin AI-generates an animation (gpt-5-mini → sanitised SVG); it renders on the
// Building-Block card. The OpenAI call is stubbed; a script-laden SVG must be rejected.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const VALID_SVG =
  '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="10" y="70" width="40" height="40" fill="#1c6dd0"><animate attributeName="x" from="10" to="260" dur="2s" repeatCount="indefinite"/></rect>' +
  '<text x="160" y="100" text-anchor="middle" font-size="14">24 x 5 = 120</text></svg>';
const SCRIPT_SVG = '<svg viewBox="0 0 320 180"><rect width="10" height="10"/><script>alert(1)</script></svg>';

let stubContent = VALID_SVG;
function startStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: stubContent } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

const CONTENT = [
  '## 1. The Selective Trap', 'Spot it.', '',
  '## 2. The Intuitive Building Block', 'Think in boxes.', '',
  '## 3. The Speed Shortcut', 'Fast.', '',
  '## 4. Guided Quiz', 'Done.',
].join('\n');

async function seedApprovedModule(): Promise<number> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
  const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });
  const mod = await prisma.coachingModule.create({
    data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Anim Lesson', content: CONTENT, status: 'approved' },
  });
  return mod.id;
}

async function generateAndWait(admin: import('@playwright/test').APIRequestContext, id: number): Promise<string> {
  const start = await admin.post(`/api/coaching/modules/${id}/media/animation/generate`, { data: {} });
  expect(start.status()).toBe(202);
  const { jobId } = await start.json();
  for (let i = 0; i < 100; i++) {
    const job = await (await admin.get(`/api/coaching/jobs/${jobId}`)).json();
    if (job.status === 'done' || job.status === 'error') return job.status;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('animation generation timed out');
}

test.describe('W-128/W-129 — AI-generated lesson animation', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('admin generates an animation → student sees the inline SVG on the Building-Block card', async ({ browser, baseURL }) => {
    stubContent = VALID_SVG;
    const moduleId = await seedApprovedModule();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    expect(await generateAndWait(admin, moduleId)).toBe('done');
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.mediaKind).toBe('animation');
    expect(mod.mediaSvg).toContain('<svg');
    expect(mod.mediaSvg).toContain('<animate');
    await admin.dispose();

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/student.json' });
    const page = await ctx.newPage();
    await page.goto(`/lesson/${moduleId}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block card
    await expect(page.getByRole('heading', { name: /Building Block/ })).toBeVisible();
    await expect(page.locator('svg animate')).toHaveCount(1);
    await expect(page.getByText('24 x 5 = 120')).toBeVisible();
    await page.screenshot({ path: 'docs/screenshots/w129-student-animation.png' });
    await ctx.close();
  });

  test('an SVG containing <script> is rejected — nothing is stored', async ({ baseURL }) => {
    stubContent = SCRIPT_SVG;
    const moduleId = await seedApprovedModule();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    expect(await generateAndWait(admin, moduleId)).toBe('error');
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.mediaKind).toBe('none');
    expect(mod.mediaSvg).toBeNull();
    await admin.dispose();
  });
});
