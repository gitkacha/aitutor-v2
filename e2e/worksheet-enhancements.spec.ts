import { test, expect, APIRequestContext } from '@playwright/test';
import http from 'http';

// Covers the reported worksheet issues:
//   W1  — generation must produce EXACTLY the requested number of questions
//         (a single LLM call quietly under-delivers, e.g. 25 of 35);
//   a1  — the admin chooses the question count;
//   a2  — students get 1 minute per question on worksheet tests;
//   b   — pending (unattempted) worksheets are visible at a glance on the
//         Dashboard (student, with one-click start) and the Admin page.

const STUB_PORT = 3106;
const STUB_BATCH_SIZE = 10; // stub under-delivers vs a 35-question ask, like the real model did

function makeStubQuestions(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    questionText: `Stub question ${i + 1}: what is ${i + 2} × 10?`,
    options: [`${(i + 2) * 10 - 10}`, `${(i + 2) * 10}`, `${(i + 2) * 10 + 10}`, `${(i + 2) * 10 + 20}`, `${(i + 2) * 10 + 30}`],
    correctIndex: 1,
    explanation: `${i + 2} × 10 = ${(i + 2) * 10}. Therefore, the answer is Option B.`,
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  }));
}

function startGenerationStub(calls: { count: number }): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('independently solving')) {
        // Answer-key verification call: all stub questions really are index 1.
        reply = { correctIndex: 1 };
      } else {
        calls.count++; // count generation calls only
        reply = makeStubQuestions(STUB_BATCH_SIZE);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

const TIMING_QUESTIONS = [
  { questionText: 'What is 12 + 13?', options: ['20', '25', '30', '35', '40'], correctIndex: 1, explanation: '12 + 13 = 25.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
  { questionText: 'What is 6 × 7?', options: ['36', '40', '42', '48', '54'], correctIndex: 2, explanation: '6 × 7 = 42.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
  { questionText: 'What is 100 − 58?', options: ['32', '38', '42', '48', '52'], correctIndex: 2, explanation: '100 − 58 = 42.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
];

async function saveMathWorksheet(request: APIRequestContext, title: string) {
  const res = await request.post('/api/math/worksheets/save', {
    data: { title, topicIds: ['arithmetic'], questions: TIMING_QUESTIONS },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

test.describe('W1/a1 — exact-count worksheet generation', () => {
  test('generates exactly the requested questionCount even when the model under-delivers per call', async ({ request }) => {
    const calls = { count: 0 };
    const stub = await startGenerationStub(calls);
    try {
      const res = await request.post('/api/math/worksheets/generate', {
        data: { topicIds: ['arithmetic'], questionCount: 12 },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.questions.length, 'must deliver exactly the requested count').toBe(12);
      expect(calls.count, 'must top up with additional calls').toBeGreaterThan(1);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('defaults to exactly 35 questions when no count is given', async ({ request }) => {
    const calls = { count: 0 };
    const stub = await startGenerationStub(calls);
    try {
      const res = await request.post('/api/math/worksheets/generate', {
        data: { topicIds: ['arithmetic'] },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.questions.length, 'the reported bug: 35 requested, fewer delivered').toBe(35);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('admin can choose the question count in the UI', async ({ page }) => {
    const calls = { count: 0 };
    const stub = await startGenerationStub(calls);
    try {
      await page.goto('/admin');
      await page.locator('main').getByRole('button', { name: 'Mathematics' }).click();
      const countInput = page.getByLabel(/questions/i);
      await countInput.fill('8');
      await page.getByRole('button', { name: /Generate .*Worksheet/ }).click();
      await expect(page.getByText('8 questions generated. Review and save')).toBeVisible({ timeout: 15_000 });
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});

test.describe('a2 — worksheet timing is 1 minute per question', () => {
  test('a 3-question worksheet starts with a 3:00 countdown', async ({ page, request }) => {
    const title = `E2E Timing Worksheet ${Date.now()}`;
    await saveMathWorksheet(request, title);

    await page.goto('/math/arithmetic');
    await page
      .locator('div')
      .filter({ hasText: title })
      .getByRole('button', { name: 'Start', exact: true })
      .last()
      .click();
    await expect(page.getByText(/^\d+ \/ 3$/)).toBeVisible();

    // 3 questions × 60s = 3:00 (the old 69s/question formula would show 3:27).
    await expect(page.locator('span', { hasText: /^\d+:\d{2}$/ }).first()).toHaveText(/^(3:00|2:5\d)$/);
  });
});

test.describe('b — pending worksheets quick view', () => {
  test('dashboard lists pending worksheets from both subjects and starts one directly', async ({ page, request }) => {
    const mathTitle = `E2E Pending Math ${Date.now()}`;
    await saveMathWorksheet(request, mathTitle);

    const writingType = await (await request.get('/api/types/persuasive')).json();
    const writingTitle = `E2E Pending Writing ${Date.now()}`;
    const wRes = await request.post('/api/worksheets/save', {
      data: { title: writingTitle, typeIds: [writingType.id], prompts: ['Argue for a longer lunch break.'] },
    });
    expect(wRes.status()).toBe(201);

    await page.goto('/dashboard');
    const panel = page.locator('section', { hasText: 'Pending Worksheets' });
    await expect(panel.getByText(mathTitle)).toBeVisible();
    await expect(panel.getByText(writingTitle)).toBeVisible();

    // One-click start from the dashboard goes straight into the worksheet test.
    await panel
      .locator('div')
      .filter({ hasText: mathTitle })
      .getByRole('button', { name: 'Start', exact: true })
      .last()
      .click();
    await expect(page.getByText(/^\d+ \/ 3$/)).toBeVisible();
    await expect(page.getByText('What is 12 + 13?')).toBeVisible();
  });

  test('admin page lists pending worksheets without entering a subject tab', async ({ page, request }) => {
    const mathTitle = `E2E Admin Pending ${Date.now()}`;
    await saveMathWorksheet(request, mathTitle);

    await page.goto('/admin');
    const panel = page.locator('section', { hasText: 'Pending Worksheets' });
    await expect(panel.getByText(mathTitle)).toBeVisible();
  });
});
