import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import path from 'path';

// W-90 (Thinking Skills, Task 2): GET /api/math/topics is subject-aware and DEFAULTS to 'math'
// (so today's behaviour is unchanged). ?subject=thinking-skills returns only thinking-skills topics.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });

const PROBE_SLUG = 'ts-probe-topic';

test.describe('W-90 — subject-aware topics route', () => {
  test.beforeAll(async () => {
    await prisma.mathTopic.upsert({
      where: { slug: PROBE_SLUG },
      update: { subject: 'thinking-skills' },
      create: { slug: PROBE_SLUG, subject: 'thinking-skills', name: 'TS Probe Topic', description: 'probe' },
    });
  });
  test.afterAll(async () => {
    await prisma.mathTopic.deleteMany({ where: { slug: PROBE_SLUG } });
    await prisma.$disconnect();
  });

  test('default lists math topics only; ?subject=thinking-skills lists thinking-skills only', async ({ request }) => {
    // Default → math only (a real math topic present, the thinking-skills probe absent).
    const def = await (await request.get('/api/math/topics')).json();
    const defSlugs = def.map((t: any) => t.slug);
    expect(defSlugs).toContain('algebra');
    expect(defSlugs).not.toContain(PROBE_SLUG);
    expect(def.every((t: any) => t.subject === 'math')).toBe(true);

    // ?subject=thinking-skills → thinking-skills only (the probe present, no math topic).
    const ts = await (await request.get('/api/math/topics?subject=thinking-skills')).json();
    const tsSlugs = ts.map((t: any) => t.slug);
    expect(tsSlugs).toContain(PROBE_SLUG);
    expect(tsSlugs).not.toContain('algebra');
    expect(ts.every((t: any) => t.subject === 'thinking-skills')).toBe(true);
  });
});
