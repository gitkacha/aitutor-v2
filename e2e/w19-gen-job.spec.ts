import { test, expect, request as pwRequest } from '@playwright/test';
import http from 'http';

// W-19: worksheet generation runs as an in-memory server job so the admin can navigate
// away and return to find it. POST /generate returns a jobId immediately; the result is
// fetched from GET .../jobs/:id. Jobs are workspace-scoped.

test.use({ storageState: 'e2e/.auth/admin.json' });

async function pollJob(request: any, url: string, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const res = await request.get(url);
    expect(res.status()).toBe(200);
    const body = await res.json();
    if (body.status === 'done' || body.status === 'error') return body;
    if (Date.now() > deadline) throw new Error('job did not finish in time');
    await new Promise((r) => setTimeout(r, 300));
  }
}

test.describe('W-19 — generation job (API)', () => {
  test('POST generate returns a jobId; the result is polled; other workspaces cannot read it', async ({ request, baseURL }) => {
    const start = await request.post('/api/math/worksheets/generate', {
      data: { topicIds: ['arithmetic'], questionCount: 5 },
    });
    expect(start.status(), 'generate starts a job (202)').toBe(202);
    const { jobId } = await start.json();
    expect(jobId, 'a jobId is returned, not the questions').toBeTruthy();

    const done = await pollJob(request, `/api/math/worksheets/jobs/${jobId}`);
    expect(done.status).toBe('done');
    expect(Array.isArray(done.result.questions)).toBe(true);
    expect(done.result.questions.length).toBe(5);

    // An admin in a different workspace cannot read this job.
    const sup = await pwRequest.newContext({ baseURL });
    await sup.post('/api/auth/login', { data: { email: 'e2e-super@test.local', password: 'test1234' } });
    const stamp = Date.now();
    const wsRes = await sup.post('/api/superadmin/workspaces', {
      data: { workspaceName: `W19 WS ${stamp}`, adminName: 'W19 Admin', adminEmail: `w19-${stamp}@test.local`, adminPassword: 'test1234' },
    });
    expect(wsRes.status()).toBe(201);
    const otherAdmin = await pwRequest.newContext({ baseURL });
    await otherAdmin.post('/api/auth/login', { data: { email: `w19-${stamp}@test.local`, password: 'test1234' } });
    expect((await otherAdmin.get(`/api/math/worksheets/jobs/${jobId}`)).status()).toBe(404);
    await sup.dispose();
    await otherAdmin.dispose();
  });
});

test.describe('W-19 — generation survives navigation (UI)', () => {
  const STUB_PORT = 3106;
  let stub: http.Server;

  test.beforeAll(async () => {
    // A slow stub keeps the job 'running' long enough to navigate away and back.
    stub = await new Promise<http.Server>((resolve) => {
      const s = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
          const isVerify = body.includes('audit its answer key');
          const isTagCheck = body.includes('skill tag');
          const q = (n: number) => ({ questionText: `SlowQ${n}: 25 x 4 = ?`, options: ['80', '100', '120', '125', '150'], correctIndex: 1, explanation: '25 x 4 = 100.', topicSlug: 'arithmetic', topicName: 'Arithmetic', skillSlug: 'mental-multiplication-strategies' });
          const content = isTagCheck ? JSON.stringify({ skillSlug: 'mental-multiplication-strategies' })
            : isVerify ? JSON.stringify({ correctIndex: 1 }) : JSON.stringify([1, 2, 3, 4, 5].map(q));
          setTimeout(() => {
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ choices: [{ message: { content } }] }));
          }, 1500);
        });
      });
      s.listen(STUB_PORT, '127.0.0.1', () => resolve(s));
    });
  });
  test.afterAll(async () => { await new Promise((r) => stub.close(r)); });

  test('starting a generation, navigating away and back, still shows the review', async ({ page }) => {
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    // Keep it to one batch so the slow stub finishes within the test window.
    await page.getByLabel('Number of questions').fill('5');
    await page.getByRole('button', { name: /Generate .*Question/ }).click();
    // It's now generating; leave the page immediately.
    await expect(page.getByText(/Generating/i)).toBeVisible();
    await page.goto('/dashboard');
    await expect(page.getByText('Progress Dashboard')).toBeVisible();

    // Come back — the finished (or still-running) generation is picked back up.
    await page.goto('/admin');
    await page.getByRole('button', { name: 'Mathematics', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Review Generated Questions' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/SlowQ1/)).toBeVisible();
  });
});
