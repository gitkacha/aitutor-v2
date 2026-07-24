import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import http from 'http';

// M3a Task 9: the writing analysis call additionally returns per-criterion scores for the
// 7 writing skills, persisted as Analysis.criteriaScores (JSON string). Those rows feed the
// admin writing skill report (GET /api/analytics/students/:id/report?subject=writing), whose
// signals were built in Tasks 5-6 but had no producer until now.
//
// The e2e backend runs with OPENAI_BASE_URL=http://127.0.0.1:3106/v1, so this spec fully
// controls the analysis response, including its new "criteria" object.

const STUB_PORT = 3106;

// The approved closed writing-criteria taxonomy (backend/prisma/seed-skills.ts WRITING_SKILLS).
// Deliberately hardcoded here so the spec catches drift in the production source of truth.
const WRITING_SLUGS = [
  'vocabulary',
  'sentence-variety',
  'ideas',
  'text-structure',
  'punctuation-grammar',
  'audience',
  'cohesion',
];

const STUB_CRITERIA: Record<string, number> = {
  vocabulary: 81,
  'sentence-variety': 66,
  ideas: 88,
  'text-structure': 72,
  'punctuation-grammar': 77,
  audience: 69,
  cohesion: 74,
};

const STUB_ANALYSIS = {
  vocabScore: 82,
  vocabComments: 'Strong vocabulary with words like "unforgettable".',
  structureScore: 74,
  structureComments: 'Varied sentence openings; some run-ons.',
  contentScore: 79,
  contentComments: 'Follows the persuasive structure well.',
  overallScore: 78,
  summary: 'A convincing piece with room to tighten sentence flow.',
  criteria: STUB_CRITERIA,
};

function startOpenAiStub(capturedPrompts: string[]): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      capturedPrompts.push(body);
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
      text: 'Homework on weekends should be abolished because rest fuels learning. Students who recharge return sharper and more curious on Monday.',
      startedAt: new Date(now - 900_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 900,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

test.describe('M3a Task 9 — writing criteria scores feed the writing skill report', () => {
  test('analysis stores criteriaScores for the 7 writing criteria and the admin report surfaces them', async ({ request, baseURL }) => {
    const attemptId = await createAttempt(request);

    const capturedPrompts: string[] = [];
    const stub = await startOpenAiStub(capturedPrompts);
    try {
      const res = await request.post(`/api/analysis/${attemptId}`);
      expect(res.ok(), 'analysis must succeed against the stub').toBeTruthy();
      const analysis = await res.json();

      // Existing headline scores are untouched.
      expect(analysis.overallScore).toBe(STUB_ANALYSIS.overallScore);

      // The analysis prompt must ask for the closed criteria list — every slug spelled out.
      expect(capturedPrompts.length).toBe(1);
      for (const slug of WRITING_SLUGS) {
        expect(capturedPrompts[0], `analysis prompt must name the "${slug}" criterion`).toContain(slug);
      }

      // The persisted row carries criteriaScores: a JSON object whose keys are a subset of
      // the 7 writing slugs, values 0-100.
      expect(analysis.criteriaScores, 'analysis row must include criteriaScores').toBeTruthy();
      const scores = JSON.parse(analysis.criteriaScores);
      expect(typeof scores).toBe('object');
      const keys = Object.keys(scores);
      expect(keys.length).toBeGreaterThan(0);
      for (const key of keys) {
        expect(WRITING_SLUGS, `criteria key "${key}" must be a known writing slug`).toContain(key);
        expect(typeof scores[key]).toBe('number');
        expect(scores[key]).toBeGreaterThanOrEqual(0);
        expect(scores[key]).toBeLessThanOrEqual(100);
      }
      // The stub scored all 7 — all 7 must survive the round trip.
      expect(scores).toEqual(STUB_CRITERIA);

      // Refetching the attempt returns the same persisted criteria (not a one-off response field).
      const refetched = await (await request.get(`/api/attempts/${attemptId}`)).json();
      expect(JSON.parse(refetched.analysis.criteriaScores)).toEqual(STUB_CRITERIA);

      // The admin writing report now has real signal: vocabulary with n >= 1.
      const me = await (await request.get('/api/auth/me')).json();
      const studentId: number = me.user.id;
      const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
      try {
        const reportRes = await admin.get(`/api/analytics/students/${studentId}/report?subject=writing`);
        expect(reportRes.status()).toBe(200);
        const report = await reportRes.json();
        const vocab = report.skills.find((s: { slug: string }) => s.slug === 'vocabulary');
        expect(vocab, 'writing report must contain a vocabulary signal').toBeTruthy();
        expect(vocab.n).toBeGreaterThanOrEqual(1);
        expect(vocab.mean).toBeGreaterThanOrEqual(0);
        expect(vocab.mean).toBeLessThanOrEqual(100);
      } finally {
        await admin.dispose();
      }
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('a malformed criteria object never fails the analysis — criteriaScores stored as null', async ({ request }) => {
    const attemptId = await createAttempt(request);

    // Old-style provider response: valid headline scores, criteria malformed (a string).
    const badServer = http.createServer((req, res) => {
      req.on('data', () => {});
      req.on('end', () => {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({ ...STUB_ANALYSIS, criteria: 'not-an-object' }),
                },
              },
            ],
          })
        );
      });
    });
    await new Promise<void>((resolve) => badServer.listen(STUB_PORT, '127.0.0.1', () => resolve()));
    try {
      const res = await request.post(`/api/analysis/${attemptId}`);
      expect(res.ok(), 'malformed criteria must not fail the analysis').toBeTruthy();
      const analysis = await res.json();
      expect(analysis.overallScore).toBe(STUB_ANALYSIS.overallScore);
      expect(analysis.criteriaScores).toBeNull();
    } finally {
      await new Promise((r) => badServer.close(r));
    }
  });
});
