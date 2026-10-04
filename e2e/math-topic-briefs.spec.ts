import { test, expect } from '@playwright/test';
import { generateMath } from './helpers/generate';
import http from 'http';

// W-142: with the default variant (MATH_TOPIC_BRIEFS on), generating a worksheet for a briefed
// topic (data-interpretation) must send the DISTRACTOR RULE + FIGURES rule in the prompt to OpenAI,
// and still produce a valid worksheet. Baseline (variant off) is covered by unit tests.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;

const good = (n: number) => ({
  questionText: `BRIEFQ${n}: a value rises from 2.2 to 6.6; what is the total increase?`,
  options: ['4.4', '2.2', '6.6', '8.8', '3.3'],
  correctIndex: 0,
  explanation: '6.6 - 2.2 = 4.4. If you chose 6.6 you read the end value instead of the increase. Therefore, the answer is Option A.',
  topicSlug: 'data-interpretation',
  topicName: 'Data Interpretation',
  skillSlug: 'bar-and-line-graphs',
});

function startStub(log: { sawDistractor: boolean; sawFigures: boolean }): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('audit its answer key')) {
        reply = { correctIndex: 0 };
      } else if (content.includes('skill tag')) {
        reply = { skillSlug: 'bar-and-line-graphs' };
      } else {
        // This is the generation call — record whether the briefs made it into the prompt.
        if (content.includes('DISTRACTOR RULE')) log.sawDistractor = true;
        if (content.includes('FIGURES — DRAW THEM ACCURATELY')) log.sawFigures = true;
        reply = [1, 2, 3, 4, 5].map(good);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('W-142 — topic briefs reach the generation prompt (default variant)', () => {
  test('briefed topic generation sends DISTRACTOR + FIGURES rules and yields a valid worksheet', async ({ request }) => {
    const log = { sawDistractor: false, sawFigures: false };
    const stub = await startStub(log);
    try {
      const result = await generateMath(request, { topicIds: ['data-interpretation'], questionCount: 5 });
      expect(result.questions.length).toBe(5);
      expect(log.sawDistractor, 'DISTRACTOR RULE reached the generation prompt').toBe(true);
      expect(log.sawFigures, 'FIGURES rule reached the generation prompt').toBe(true);
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
