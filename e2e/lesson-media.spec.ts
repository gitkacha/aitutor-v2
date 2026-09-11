import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-126/W-127: an admin attaches media to a lesson (embed a YouTube/Vimeo link, or upload a video);
// it plays on the "Intuitive Building Block" card in the student player.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

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
    data: { workspaceId: admin.workspaceId, skillId: skill.id, title: 'Media Lesson', content: CONTENT, status: 'approved' },
  });
  return mod.id;
}

test.describe('W-126/W-127 — lesson media stage', () => {
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('admin embeds a YouTube link → student sees an iframe on the Building-Block card', async ({ browser, baseURL }) => {
    const moduleId = await seedApprovedModule();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const res = await admin.patch(`/api/coaching/modules/${moduleId}/media`, {
      data: { kind: 'embed', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.mediaKind).toBe('embed');
    expect(body.mediaUrl).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    await admin.dispose();

    // Admin editor shows the Media panel with the embedded preview.
    const adminCtx = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
    const adminPage = await adminCtx.newPage();
    await adminPage.goto(`/admin/modules/${moduleId}`);
    await expect(adminPage.getByText('Building-block media')).toBeVisible();
    await adminPage.screenshot({ path: 'docs/screenshots/w127-admin-media.png', fullPage: true });
    await adminCtx.close();

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/student.json' });
    const page = await ctx.newPage();
    await page.goto(`/lesson/${moduleId}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block card
    await expect(page.getByRole('heading', { name: /Building Block/ })).toBeVisible();
    const iframe = page.locator('iframe');
    await expect(iframe).toBeVisible();
    expect(await iframe.getAttribute('src')).toContain('youtube.com/embed/dQw4w9WgXcQ');
    await page.screenshot({ path: 'docs/screenshots/w127-student-embed.png' });
    await ctx.close();
  });

  test('rejects a non-YouTube/Vimeo embed link (400) — no arbitrary iframes', async ({ baseURL }) => {
    const moduleId = await seedApprovedModule();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const res = await admin.patch(`/api/coaching/modules/${moduleId}/media`, {
      data: { kind: 'embed', url: 'https://evil.example.com/embed/xyz' },
    });
    expect(res.status()).toBe(400);
    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.mediaKind).toBe('none');
    await admin.dispose();
  });

  test('admin uploads a video → served under /api/media and shown as a <video>', async ({ browser, baseURL }) => {
    const moduleId = await seedApprovedModule();
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const res = await admin.post(`/api/coaching/modules/${moduleId}/media/upload`, {
      multipart: { file: { name: 'clip.mp4', mimeType: 'video/mp4', buffer: Buffer.from('FAKE-VIDEO-BYTES') } },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.mediaKind).toBe('upload');
    expect(body.mediaUrl).toMatch(/^\/api\/media\//);
    // The uploaded file is served back.
    expect((await admin.get(body.mediaUrl)).status()).toBe(200);
    await admin.dispose();

    const ctx = await browser.newContext({ storageState: 'e2e/.auth/student.json' });
    const page = await ctx.newPage();
    await page.goto(`/lesson/${moduleId}`);
    await page.getByRole('button', { name: 'Next' }).click(); // → Building Block card
    await expect(page.getByRole('heading', { name: /Building Block/ })).toBeVisible();
    await expect(page.locator('video')).toBeVisible();
    await ctx.close();
  });
});
