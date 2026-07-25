import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// M3c Phase 2a (W-64): the /api/coaching router — generation job, approved-only visibility, and
// approve. Router behaviour is proven at the API level (the repo has no supertest); the AI is a
// per-spec stub on 3106 that branches on the request body: our generation prompt contains
// "coaching lesson", our verifier prompt contains "maths checker".

const dbPath = path.resolve(__dirname, '../backend/prisma/e2e.db');
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbPath}` } } });
const STUB_PORT = 3106;

// A clean draft with correct arithmetic so the verifier passes on the first try.
const GOOD_MODULE = `## The idea
A number sentence is a see-saw — both sides weigh the same.

## Step by step
1. Cover the missing number.
2. Find the target.
3. Undo with the opposite operation.

## Worked examples
7 + 5 = 12, so the missing number in 7 + ▢ = 12 is 5.

## Traps to avoid
Doing the same operation instead of the opposite.`;

function startCoachingStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const isVerify = body.includes('maths checker');
      const content = isVerify ? JSON.stringify({ ok: true, warnings: [] }) : GOOD_MODULE;
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

async function pollJob(ctx: APIRequestContext, jobId: string, timeoutMs = 30000): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await ctx.get(`/api/coaching/jobs/${jobId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.status === 'done' || body.status === 'error') return body;
    if (Date.now() > deadline) throw new Error('coaching generation did not finish in time');
    await new Promise((r) => setTimeout(r, 250));
  }
}

test.describe('M3c Phase 2a — coaching router (generate, visibility, approve)', () => {
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startCoachingStub(); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('generate → draft hidden from students (404) → approve → visible (200)', async ({ baseURL }) => {
    const skill = await prisma.skill.findFirstOrThrow({ where: { subject: 'math', topicId: { not: null } } });

    const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
    const student = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/student.json' });

    // Generate a lesson for the skill (async job → poll).
    const start = await admin.post('/api/coaching/modules/generate', { data: { skillId: skill.id } });
    expect(start.status(), 'generate starts a job (202)').toBe(202);
    const { jobId } = await start.json();
    expect(jobId).toBeTruthy();

    const done = await pollJob(admin, jobId);
    expect(done.status).toBe('done');
    const moduleId: number = done.result.moduleId;
    expect(moduleId).toBeTruthy();
    expect(done.result.verifierWarnings, 'clean draft has no warnings').toEqual([]);

    // Admin sees the draft with its content.
    const adminView = await admin.get(`/api/coaching/modules/${moduleId}`);
    expect(adminView.status()).toBe(200);
    const mod = await adminView.json();
    expect(mod.status).toBe('draft');
    expect(mod.content).toContain('The idea');

    // A student must NOT see a draft — 404 (existence not revealed, not 403).
    expect((await student.get(`/api/coaching/modules/${moduleId}`)).status(), 'draft hidden from student').toBe(404);

    // Approve it.
    const approve = await admin.post(`/api/coaching/modules/${moduleId}/approve`);
    expect(approve.status()).toBe(200);
    expect((await approve.json()).status).toBe('approved');

    // Now the student can read the approved lesson.
    const studentView = await student.get(`/api/coaching/modules/${moduleId}`);
    expect(studentView.status(), 'approved lesson visible to student').toBe(200);
    expect((await studentView.json()).content).toContain('The idea');

    await admin.dispose();
    await student.dispose();
  });
});
