import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import http from 'http';
import path from 'path';

// M3c Phase 2a (W-64): the /api/coaching router — generation job, approved-only visibility, and
// approve. Router behaviour is proven at the API level (the repo has no supertest); the AI is a
// per-spec stub on 3106 that branches on the request body: only the verifier prompt contains
// "Check ONLY the arithmetic" (the retry generation prompt also says "maths checker").

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

// A draft whose worked example is arithmetically WRONG — the verifier flags it every time, so the
// generated draft carries a warning (exercises the editor's warning banner).
const BAD_MODULE = `## The idea
A number sentence is a see-saw.

## Worked examples
3 + 4 = 8, so this is how balancing works.

## Traps to avoid
Rushing.`;

// mode 'clean' → verifier always passes; mode 'flag' → verifier always flags (draft keeps warnings).
function startCoachingStub(mode: 'clean' | 'flag'): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      // The verifier prompt is the only one containing this phrase (the retry generation prompt
      // also mentions "maths checker", so match on something verifier-unique).
      const isVerify = body.includes('Check ONLY the arithmetic');
      const content = isVerify
        ? JSON.stringify(mode === 'clean' ? { ok: true, warnings: [] } : { ok: false, warnings: ['Worked example: 3 + 4 is 7, not 8'] })
        : mode === 'clean' ? GOOD_MODULE : BAD_MODULE;
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
  test.beforeAll(async () => { stub = await startCoachingStub('clean'); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); });

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

test.describe('M3c Phase 2a — generate from Skills → editor → approve (UI)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' });
  let stub: http.Server;
  test.beforeAll(async () => { stub = await startCoachingStub('flag'); });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); await prisma.$disconnect(); });

  test('admin generates a lesson, sees the verifier warning, and approves it', async ({ page }) => {
    await page.goto('/skills');
    // Any math skill without a lesson yet shows the A/B generate options; "Standard" is approach A (W-118).
    const generate = page.getByRole('button', { name: 'Standard' }).first();
    await expect(generate).toBeVisible();
    await generate.click();

    // Lands on the module editor with the generated (flagged) draft.
    await expect(page).toHaveURL(/\/admin\/modules\/\d+/);
    await expect(page.getByText(/maths checker flagged/i)).toBeVisible();
    await expect(page.getByText('Worked example: 3 + 4 is 7, not 8')).toBeVisible();
    // The markdown preview rendered the content.
    await expect(page.getByRole('heading', { name: 'The idea' })).toBeVisible();
    // Draft status before approval.
    await expect(page.getByText('Draft', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Approve' }).click();
    // The status pill flips to Approved and the button becomes a disabled "Approved".
    await expect(page.getByRole('button', { name: 'Approved' })).toBeDisabled();
  });
});
