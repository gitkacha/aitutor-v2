import { test, expect } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// Phase C / C2 (W-111): admins can generate a coaching lesson for a Thinking Skills skill (the
// route no longer restricts to math). Model stubbed; TS skips the arithmetic verifier.
const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

const LESSON = `## The idea
Spot what must be true.

## Step by step
Test each option against the clues.

## Worked examples
If A sits left of B and B left of C, then A is left of C.

## Traps to avoid
Do not accept an option that only *could* be true.`;

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

test.describe('W-111 — generate a Thinking Skills coaching lesson', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('POST /coaching/modules/generate creates a draft for a Thinking Skills skill', async ({ page }) => {
    const skill = await prisma.skill.findFirstOrThrow({ where: { slug: 'logical-analysis', subject: 'thinking-skills' } });

    const start = await page.request.post('/api/coaching/modules/generate', { data: { skillId: skill.id } });
    expect(start.status()).toBe(202);
    const { jobId } = await start.json();

    let moduleId = 0;
    for (let i = 0; i < 100; i++) {
      const job = await (await page.request.get(`/api/coaching/jobs/${jobId}`)).json();
      if (job.status === 'done') { moduleId = job.result.moduleId; break; }
      if (job.status === 'error') throw new Error(job.error);
      await new Promise((r) => setTimeout(r, 200));
    }
    expect(moduleId).toBeGreaterThan(0);

    const mod = await prisma.coachingModule.findUniqueOrThrow({ where: { id: moduleId } });
    expect(mod.skillId).toBe(skill.id);
    expect(mod.status).toBe('draft');
    expect(mod.content).toContain('The idea');
  });
});
