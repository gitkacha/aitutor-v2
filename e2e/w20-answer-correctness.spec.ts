import { test, expect } from '@playwright/test';
import { generateMath } from './helpers/generate';
import http from 'http';

// W-20: answer-key correctness hardening. Deterministic guards reject unanswerable /
// self-contradictory questions at save; verification moves to an independent o4-mini auditor
// that escalates to 3 solves on disagreement. Runs as the seeded e2e admin.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;

interface Log { verifyByMarker: Record<string, number>; verifyModels: string[]; }

function markerOf(text: string): string {
  return (text.match(/GOOD\d|CONTESTED|NONEOPT/) || ['?'])[0];
}

function startStub(log: Log): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const content: string = parsed.messages?.[0]?.content || '';
      if (content.includes('audit its answer key')) {
        // Verification request.
        log.verifyModels.push(parsed.model);
        const m = markerOf(content);
        log.verifyByMarker[m] = (log.verifyByMarker[m] || 0) + 1;
        const verdict = m === 'CONTESTED' ? { correctIndex: 0 }        // disagree (key is 1)
          : m === 'NONEOPT' ? { correctIndex: -1 }                     // none of the options
          : { correctIndex: 1 };                                       // GOOD → agree
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(verdict) } }] }));
        return;
      }
      // Generation request → 5 valid questions + one contested + one none-of-these.
      const good = (n: number) => ({ questionText: `GOOD${n}: what is 2 + 2?`, options: ['3', '4', '5', '6', '7'], correctIndex: 1, explanation: 'Two plus two is 4. The answer is Option B.', topicSlug: 'arithmetic', topicName: 'Arithmetic' });
      const questions = [
        ...[1, 2, 3, 4, 5].map(good),
        { questionText: 'CONTESTED: a tricky number pattern', options: ['10', '12', '14', '16', '18'], correctIndex: 1, explanation: 'The pattern gives 12. The answer is Option B.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
        { questionText: 'NONEOPT: the real answer is not listed', options: ['1', '2', '3', '5', '6'], correctIndex: 1, explanation: 'The answer is Option B.', topicSlug: 'arithmetic', topicName: 'Arithmetic' },
      ];
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(questions) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('W-20 — verification uses an independent o4-mini auditor that escalates', () => {
  test('bad-key questions are dropped; agreeing questions cost 1 verify, contested ones escalate to 3', async ({ request }) => {
    const log: Log = { verifyByMarker: {}, verifyModels: [] };
    const stub = await startStub(log);
    try {
      const result = await generateMath(request, { topicIds: ['arithmetic'], questionCount: 5 });

      // Only the 5 verified GOOD questions survive; contested / none-of-these are dropped.
      expect(result.questions.length).toBe(5);
      expect(result.questions.every((q: any) => /^GOOD\d/.test(q.questionText))).toBe(true);

      // The verifier is the independent o4-mini model, not the generator's gpt-5-mini.
      expect(log.verifyModels.length).toBeGreaterThan(0);
      expect(log.verifyModels.every((m) => m === 'o4-mini')).toBe(true);

      // Escalation efficiency: an agreeing question is verified once; a contested one 3x.
      expect(log.verifyByMarker['GOOD1']).toBe(1);
      expect(log.verifyByMarker['CONTESTED']).toBe(3);
      expect(log.verifyByMarker['NONEOPT']).toBe(3);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});

test.describe('W-20 — save-time deterministic guards', () => {
  const base = { topicSlug: 'arithmetic' };

  test('rejects a worksheet with equal-value options', async ({ request }) => {
    const res = await request.post('/api/math/worksheets/save', {
      data: {
        title: 'W20 dup', topicIds: ['arithmetic'],
        questions: [{ ...base, questionText: 'P(not milk)?', options: ['5/10', '25/50', '2/5', '4/5', '3/5'], correctIndex: 0, explanation: 'It is 1/2. Option A.' }],
      },
    });
    expect(res.status(), 'equal-value options (5/10 == 25/50) must be rejected').toBe(400);
  });

  test('rejects a worksheet whose explanation names a different option than the key', async ({ request }) => {
    const res = await request.post('/api/math/worksheets/save', {
      data: {
        title: 'W20 mismatch', topicIds: ['arithmetic'],
        questions: [{ ...base, questionText: '2 + 2?', options: ['3', '4', '5', '6', '7'], correctIndex: 2, explanation: 'Two plus two is 4. The answer is Option B.' }],
      },
    });
    expect(res.status(), 'explanation says Option B but key is C — reject').toBe(400);
  });
});
