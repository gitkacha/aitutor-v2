import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// W-133/W-134: the AI animation assistant. `suggest` returns a candidate WITHOUT storing it; the admin
// previews it and commits the one they like; committing re-validates the SVG server-side.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const VALID_SVG =
  '<svg viewBox="0 0 320 180" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="10" y="70" width="40" height="40" fill="#1c6dd0"><animate attributeName="x" from="10" to="260" dur="2s" repeatCount="indefinite"/></rect></svg>';
const SCRIPT_SVG = '<svg viewBox="0 0 320 180"><rect width="10" height="10"/><script>alert(1)</script></svg>';

function startStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: VALID_SVG } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

// Figure-LESS lesson (no ```figure) → the assistant applies.
const CONTENT = [
  '## 1. The Selective Trap', 'Spot it.', '',
  '## 2. The Intuitive Building Block', 'Think in boxes.', '',
  '## 3. The Speed Shortcut', 'Fast.', '',
  '## 4. Guided Quiz', 'Done.',
].join('\n');

async function seed(): Promise<number> {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-admin@test.local' } });
  const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math' } });
  const mod = await prisma.coachingModule.create({
    data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Assistant Lesson', content: CONTENT, status: 'approved' },
  });
  return mod.id;
}

async function suggest(admin: APIRequestContext, id: number): Promise<string> {
  const start = await admin.post(`/api/coaching/modules/${id}/media/animation/suggest`, { data: { instructions: 'show the boxes filling one by one' } });
  expect(start.status()).toBe(202);
  const { jobId } = await start.json();
  for (let i = 0; i < 100; i++) {
    const job = await (await admin.get(`/api/coaching/jobs/${jobId}`)).json();
    if (job.status === 'done') return job.result.svg;
    if (job.status === 'error') throw new Error(job.error);
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('suggest timed out');
}

test.describe('W-133/W-134 — AI animation assistant', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('suggest returns a candidate WITHOUT storing it', async ({ baseURL }) => {
    const id = await seed();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const svg = await suggest(admin, id);
    expect(svg).toContain('<svg');
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id } });
    expect(mod.mediaKind).toBe('none'); // nothing stored on suggest
    expect(mod.mediaSvg).toBeNull();
    await admin.dispose();
  });

  test('commit stores a chosen candidate; a <script> SVG is rejected (400)', async ({ baseURL }) => {
    const id = await seed();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });

    const bad = await admin.post(`/api/coaching/modules/${id}/media/animation`, { data: { svg: SCRIPT_SVG } });
    expect(bad.status()).toBe(400);
    expect((await prisma.coachingModule.findUniqueOrThrow({ where: { id } })).mediaKind).toBe('none');

    const ok = await admin.post(`/api/coaching/modules/${id}/media/animation`, { data: { svg: VALID_SVG } });
    expect(ok.status()).toBe(200);
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id } });
    expect(mod.mediaKind).toBe('animation');
    expect(mod.mediaSvg).toContain('<animate');
    await admin.dispose();
  });

  test('admin UI: suggest → preview → Use this saves the animation', async ({ browser }) => {
    const id = await seed();
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const page = await ctx.newPage();
    await page.goto(`/admin/modules/${id}`);
    await expect(page.getByText('AI animation assistant')).toBeVisible();

    await page.getByRole('button', { name: 'Suggest an animation' }).click();
    const useBtn = page.getByRole('button', { name: 'Use this' });
    await expect(useBtn).toBeVisible({ timeout: 20000 });
    await page.screenshot({ path: 'docs/screenshots/w134-assistant.png', fullPage: true });
    await useBtn.click();

    // Committed → the module now has an animation; a "Remove media" control appears.
    await expect(page.getByText('Remove media')).toBeVisible();
    expect((await prisma.coachingModule.findUniqueOrThrow({ where: { id } })).mediaKind).toBe('animation');
    await ctx.close();
  });
});
