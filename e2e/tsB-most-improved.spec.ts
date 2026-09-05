import { test, expect, request as pwRequest } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// Phase B / B4 (W-108): the improvements and trend endpoints accept subject=thinking-skills, so the
// student Most Improved panel and the trend chart can surface Thinking Skills.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

test.describe('W-108 — Most Improved + trend accept thinking-skills', () => {
  test.use({ storageState: 'e2e/.auth/student.json' });
  test.afterAll(async () => { await prisma.$disconnect(); });

  test('improvements and trend endpoints serve thinking-skills', async ({ page, baseURL }) => {
    // Student's own Most Improved for both MCQ subjects.
    const ts = await page.request.get('/api/analytics/me/improvements?subject=thinking-skills');
    expect(ts.status()).toBe(200);
    expect(Array.isArray((await ts.json()).topics)).toBe(true);

    const math = await page.request.get('/api/analytics/me/improvements?subject=math');
    expect(math.status()).toBe(200);

    // A bogus subject is rejected.
    const bad = await page.request.get('/api/analytics/me/improvements?subject=writing');
    expect(bad.status()).toBe(400);

    // Admin per-skill trend accepts the TS subject.
    const student = await prisma.user.findUniqueOrThrow({ where: { email: 'e2e-student@test.local' } });
    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const trend = await admin.get(`/api/analytics/students/${student.id}/skills/visual-reasoning/trend?subject=thinking-skills`);
    expect(trend.status()).toBe(200);
    expect(Array.isArray(await trend.json())).toBe(true);
    await admin.dispose();
  });
});
