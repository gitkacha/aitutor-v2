import { test, expect, APIRequestContext } from '@playwright/test';
import http from 'http';

// C4: the AI service must use the OpenAI API with gpt-4o-mini (per CLAUDE.md), and a
// failed analysis must NOT be persisted as a fake 0-score row that poisons the heatmap.
//
// The e2e backend runs with OPENAI_BASE_URL=http://127.0.0.1:3106/v1, so this spec fully
// controls the AI endpoint: stub down = provider outage; stub up = working provider.

const STUB_PORT = 3106;

const STUB_ANALYSIS = {
  vocabScore: 82,
  vocabComments: 'Strong vocabulary with words like "unforgettable".',
  structureScore: 74,
  structureComments: 'Varied sentence openings; some run-ons.',
  contentScore: 79,
  contentComments: 'Follows the persuasive structure well.',
  overallScore: 78,
  summary: 'A convincing piece with room to tighten sentence flow.',
};

interface CapturedRequest {
  url: string | undefined;
  authorization: string | undefined;
  model: string;
}

function startOpenAiStub(captured: CapturedRequest[]): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      captured.push({ url: req.url, authorization: req.headers.authorization, model: parsed.model });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(STUB_ANALYSIS) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

async function createAttempt(request: APIRequestContext): Promise<number> {
  const type = await (await request.get('/api/types/persuasive')).json();
  const now = Date.now();
  const res = await request.post('/api/attempts', {
    data: {
      typeId: type.id,
      promptId: type.prompts[0].id,
      text: 'School uniforms should not be compulsory because they suppress individuality. Students learn best when they feel comfortable and confident.',
      startedAt: new Date(now - 900_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 900,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

test.describe('C4 — analysis provider and failure handling', () => {
  test('failed analysis is not persisted; retry after provider recovers stores real gpt-4o-mini scores', async ({ page, request }) => {
    const attemptId = await createAttempt(request);

    // Phase A — provider unreachable (stub not running).
    const failedRes = await request.post(`/api/analysis/${attemptId}`);
    expect(failedRes.ok(), 'analysis call must report failure when the AI provider is down').toBeFalsy();

    const afterFailure = await (await request.get(`/api/attempts/${attemptId}`)).json();
    expect(afterFailure.analysis, 'a failed analysis must NOT be persisted').toBeNull();

    // Phase B — provider comes back (stub up). Retrying must now succeed.
    const captured: CapturedRequest[] = [];
    const stub = await startOpenAiStub(captured);
    try {
      const okRes = await request.post(`/api/analysis/${attemptId}`);
      expect(okRes.ok(), 'analysis must succeed once the provider is reachable').toBeTruthy();
      const analysis = await okRes.json();
      expect(analysis.overallScore).toBe(STUB_ANALYSIS.overallScore);
      expect(analysis.vocabScore).toBe(STUB_ANALYSIS.vocabScore);

      // Provider contract per CLAUDE.md: OpenAI chat completions with gpt-4o-mini.
      expect(captured.length).toBe(1);
      expect(captured[0].url).toBe('/v1/chat/completions');
      expect(captured[0].model).toBe('gpt-4o-mini');
      expect(captured[0].authorization).toBe('Bearer sk-e2e-test');

      // Persisted for good: fetching the attempt returns the real scores…
      const afterSuccess = await (await request.get(`/api/attempts/${attemptId}`)).json();
      expect(afterSuccess.analysis?.overallScore).toBe(STUB_ANALYSIS.overallScore);

      // …and the student sees them on the attempt page.
      await page.goto(`/attempt/${attemptId}`);
      await expect(page.getByText(STUB_ANALYSIS.summary)).toBeVisible();
      await expect(page.getByText('78', { exact: true }).first()).toBeVisible();
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
