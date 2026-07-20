import { test, expect } from '@playwright/test';
import http from 'http';

// W-18: AI-generated worksheet explanations must be pitched at NSW-Selective / Year-6
// level and must not borrow higher-level concepts. We can't grade model output
// deterministically, so we assert the generation prompt carries that instruction.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;

// Returns a valid one-question batch for generation and confirms the key for verification,
// while capturing every request body.
function startStub(captured: string[]): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      captured.push(body);
      const isVerify = body.includes('audit its answer key');
      const q = (n: number) => ({ questionText: `Q${n}: 25 x 4 = ?`, options: ['80', '100', '120', '125', '150'], correctIndex: 1, explanation: '25 x 4 = 100.', topicSlug: 'arithmetic', topicName: 'Arithmetic' });
      const content = isVerify
        ? JSON.stringify({ correctIndex: 1 }) // matches the generated key so questions survive
        : JSON.stringify([1, 2, 3, 4, 5].map(q));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('W-18 — explanation reading level', () => {
  test('the generation prompt instructs Year-6 / NSW-Selective explanations, no higher-level concepts', async ({ request }) => {
    const captured: string[] = [];
    const stub = await startStub(captured);
    try {
      const res = await request.post('/api/math/worksheets/generate', {
        data: { topicIds: ['arithmetic'], questionCount: 1 },
      });
      expect(res.ok()).toBeTruthy();

      const genPrompt = captured.find((b) => b.includes('multiple-choice questions') && !b.includes('audit its answer key'));
      expect(genPrompt, 'a generation request must have been sent').toBeTruthy();
      expect(genPrompt!).toContain('Year 6');
      expect(genPrompt!).toMatch(/do not (use|explain).*(higher-level|secondary)/i);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
