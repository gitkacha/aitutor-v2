import { test, expect, APIRequestContext, request as pwRequest } from '@playwright/test';
import { startTest } from './helpers/practice';
import http from 'http';

// The topic-detail payload omits the answer key for students (W-29), so tests that need the
// correct answer read it back from an admin request, mapped by question id.
async function correctIndexFor(baseURL: string | undefined, slug: string, questionId: number): Promise<number> {
  const admin = await pwRequest.newContext({ baseURL });
  await admin.post('/api/auth/login', { data: { email: 'e2e-admin@test.local', password: 'test1234' } });
  const topic = await (await admin.get(`/api/math/topics/${slug}`)).json();
  await admin.dispose();
  return topic.questions.find((q: any) => q.id === questionId).correctIndex;
}

// M6–M10 (docs/review2.md §Medium):
// M6 — a failed math submission must show a visible error panel with retry (H1 parity).
// M7 — demo writing worksheets must match the post-H3 model (one prompt, one type) and
//      their attempts must reference the worksheet prompt (H4 consistency).
// M8 — a type's average must cover only analysed attempts, not count pending ones as 0.
// M9 — the All Topics page must list only All Topics tests, not every math attempt.
// M10 — POST /api/math/attempts must reject malformed payloads with 400s.

const STUB_PORT = 3106;

const STUB_ANALYSIS = {
  vocabScore: 82,
  vocabComments: 'Confident, purposeful word choices.',
  structureScore: 74,
  structureComments: 'Clear openings; a few long sentences.',
  contentScore: 78,
  contentComments: 'Addresses the speech task directly.',
  overallScore: 78,
  summary: 'A well-shaped speech with room to vary pacing.',
};

function startAnalysisStub(): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    req.on('data', () => {});
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(STUB_ANALYSIS) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

async function createMathAttempt(
  request: APIRequestContext,
  data: Record<string, unknown>
): Promise<{ status: number; body: any }> {
  const now = Date.now();
  const res = await request.post('/api/math/attempts', {
    data: {
      startedAt: new Date(now - 300_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 300,
      ...data,
    },
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

test.describe('M6 — failed math submission shows a visible error panel with retry', () => {
  test('aborted save shows the panel; Try Again submits once the backend is reachable', async ({ page }) => {
    await page.route('**/api/math/attempts', (route) =>
      route.request().method() === 'POST' ? route.abort() : route.continue()
    );

    await page.goto('/math/fractions/start');
    await startTest(page);
    await page.getByRole('button', { name: 'Submit All' }).click();
    await page.getByRole('button', { name: 'Submit Now' }).click();

    await expect(page.getByText("We couldn't save your answers")).toBeVisible();

    await page.unroute('**/api/math/attempts');
    await page.getByRole('button', { name: 'Try Again' }).click();
    await page.waitForURL(/\/math-attempt\/\d+/);
    await expect(page.getByText('Test Review')).toBeVisible();
  });
});

test.describe('M7 — demo writing worksheets follow the one-prompt-per-worksheet model', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' }); // demo load is admin-only (B1)
  test('demo load creates single-prompt worksheets whose attempt references the worksheet prompt', async ({
    request,
  }) => {
    const load = await request.post('/api/demo/load');
    expect(load.ok()).toBeTruthy();
    try {
      const worksheets = await (await request.get('/api/worksheets')).json();
      const demoWs = worksheets.filter((w: any) => w.isDemo);
      expect(demoWs.length, 'demo should provide more than one writing worksheet').toBeGreaterThanOrEqual(2);
      for (const ws of demoWs) {
        const prompts = JSON.parse(ws.prompts);
        expect(prompts.length, `worksheet "${ws.title}" must carry exactly one prompt`).toBe(1);
        expect(ws.title, 'a worksheet is a single text type').not.toContain('+');
      }

      // The demo worksheet attempt references the worksheet's own prompt (H4 consistency).
      const attempted = demoWs.find((w: any) => (w.attempts || []).length > 0);
      expect(attempted, 'one demo worksheet should carry the demo attempt').toBeTruthy();
      const attempt = await (await request.get(`/api/attempts/${attempted.attempts[0].id}`)).json();
      expect(attempt.prompt.text).toBe(JSON.parse(attempted.prompts)[0]);
    } finally {
      const clear = await request.post('/api/demo/clear');
      expect(clear.ok()).toBeTruthy();
    }
  });
});

test.describe('M8 — type average covers only analysed attempts', () => {
  test('a pending analysis does not drag the average down as a zero', async ({ page, request }) => {
    const type = await (await request.get('/api/types/news-report')).json();
    const promptId = type.prompts[0].id;
    const now = Date.now();
    const base = {
      typeId: type.id,
      promptId,
      startedAt: new Date(now - 900_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 900,
      source: 'practice',
    };

    // One analysed attempt (stubbed provider)…
    const analysed = await (await request.post('/api/attempts', {
      data: { ...base, text: 'SYDNEY: Students rallied today to save the school garden. E2E M8 report.' },
    })).json();
    const stub = await startAnalysisStub();
    try {
      const analysis = await request.post(`/api/analysis/${analysed.id}`);
      expect(analysis.ok()).toBeTruthy();
    } finally {
      await new Promise((r) => stub.close(r));
    }
    // …and one attempt with no analysis (provider down — nothing persisted).
    await request.post('/api/attempts', {
      data: { ...base, text: 'A second news report, never analysed.' },
    });

    // Expected average from the API: analysed attempts only.
    const attempts = await (await request.get('/api/attempts?type=news-report')).json();
    const scored = attempts.filter((a: any) => a.analysis?.overallScore != null);
    expect(scored.length).toBeGreaterThan(0);
    expect(scored.length, 'test needs a pending attempt to be meaningful').toBeLessThan(attempts.length);
    const expected = Math.round(
      scored.reduce((sum: number, a: any) => sum + a.analysis.overallScore, 0) / scored.length
    );

    await page.goto('/practice/news-report');
    const history = page.locator('div.bg-white').filter({ hasText: 'Your History' });
    await expect(history.getByText(`Average score: ${expected}/100`)).toBeVisible();
  });
});

test.describe('M9 — All Topics history lists only All Topics tests', () => {
  test('single-topic and worksheet attempts are not counted', async ({ page, request, baseURL }) => {
    const topic = await (await request.get('/api/math/topics/fractions')).json();
    const q = topic.questions[0];
    const correctIndex = await correctIndexFor(baseURL, 'fractions', q.id);

    // One attempt of each kind.
    for (const extra of [
      { topicId: topic.id, source: 'practice' }, // single-topic practice
      { topicId: null, source: 'worksheet' }, // worksheet-style
      { topicId: null, source: 'practice' }, // a real All Topics test
    ]) {
      const { status } = await createMathAttempt(request, {
        questions: JSON.stringify([q.id]),
        answers: JSON.stringify([correctIndex]),
        ...extra,
      });
      expect(status).toBe(201);
    }

    const all = await (await request.get('/api/math/attempts')).json();
    const expected = all.filter((a: any) => a.topicId === null && a.source === 'practice').length;
    expect(expected, 'test setup must leave a difference to detect').toBeLessThan(all.length);

    await page.goto('/math/all-topics');
    const history = page.locator('div.bg-white').filter({ hasText: 'Your History' });
    await expect(history.getByText(`${expected} attempt`, { exact: false })).toBeVisible();
  });
});

test.describe('M10 — math attempt payloads are validated', () => {
  test('malformed payloads are rejected with 400; a valid one still scores', async ({ request, baseURL }) => {
    const topic = await (await request.get('/api/math/topics/perimeter')).json();
    const q = topic.questions[0];
    const correctIndex = await correctIndexFor(baseURL, 'perimeter', q.id);

    const badPayloads: Array<[string, Record<string, unknown>]> = [
      ['mismatched lengths', { questions: JSON.stringify([q.id]), answers: JSON.stringify([]) }],
      ['non-integer elements', { questions: JSON.stringify(['abc']), answers: JSON.stringify([0]) }],
      ['empty arrays', { questions: JSON.stringify([]), answers: JSON.stringify([]) }],
      ['duplicate question ids', { questions: JSON.stringify([q.id, q.id]), answers: JSON.stringify([0, 0]) }],
      ['unknown question id', { questions: JSON.stringify([9_999_999]), answers: JSON.stringify([0]) }],
      ['unknown topicId', { topicId: 9_999_999, questions: JSON.stringify([q.id]), answers: JSON.stringify([0]) }],
    ];

    for (const [label, payload] of badPayloads) {
      const { status } = await createMathAttempt(request, payload);
      expect(status, `${label} must be rejected with 400`).toBe(400);
    }

    const ok = await createMathAttempt(request, {
      topicId: topic.id,
      questions: JSON.stringify([q.id]),
      answers: JSON.stringify([correctIndex]),
    });
    expect(ok.status).toBe(201);
    expect(ok.body.score).toBe(1);
    expect(ok.body.totalQuestions).toBe(1);
  });
});
