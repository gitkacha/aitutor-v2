import { test, expect } from '@playwright/test';
import http from 'http';
import { generateMath } from './helpers/generate';

// W-88: generation must discard a grid→compass question whose answer key disagrees with the
// geometry of the rendered grid (North = top), even if the LLM verifier would have passed it.
const STUB_PORT = 3106;
const GRID = {
  version: 1, text: '6×6 grid',
  figures: [{ kind: 'grid', rows: 6, cols: 6, filled: [], rowLabels: ['1', '2', '3', '4', '5', '6'], colLabels: ['A', 'B', 'C', 'D', 'E', 'F'] }],
};
// D3 -> B5 is 2 left + 2 down on the figure = South-West; keying it North-West is geometrically wrong.
const WRONG_Q = {
  questionText: 'Maria is at D3 and the school is at B5. Which single compass direction should Maria walk to go from D3 to B5?',
  options: ['North-East', 'North-West', 'South-East', 'South-West', 'North'], correctIndex: 1,
  explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions', stimulus: GRID,
};
const GOOD = (n: number) => ({
  questionText: `Lily is facing West. She makes ${n} quarter turns to her right. Which compass direction is she facing now?`,
  options: ['North', 'South', 'East', 'West', 'North-East'], correctIndex: 1,
  explanation: 'x', topicSlug: 'directions', topicName: 'Directions', skillSlug: 'compass-directions',
});

function startStub(): Promise<http.Server> {
  let gen = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('independently solving')) reply = { correctIndex: 1 }; // verifier passes everything
      else if (content.includes('skill tag')) reply = { skillSlug: 'compass-directions' };
      else {
        gen++;
        reply = gen === 1
          ? [WRONG_Q, GOOD(1), GOOD(2), GOOD(3), GOOD(5), GOOD(6)]
          : [GOOD(gen * 10), GOOD(gen * 10 + 1), GOOD(gen * 10 + 2)];
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((r) => server.listen(STUB_PORT, '127.0.0.1', () => r(server)));
}

test.use({ storageState: 'e2e/.auth/admin.json' });

test('generation drops a grid→compass question with a geometrically wrong key', async ({ request }) => {
  const stub = await startStub();
  try {
    const body = await generateMath(request, { topicIds: ['directions'], questionCount: 5 });
    expect(body.questions.length).toBe(5);
    expect(
      body.questions.some((q: any) => q.questionText.includes('school is at B5')),
      'the geometrically-wrong grid question must be discarded',
    ).toBe(false);
  } finally {
    await new Promise((r) => stub.close(r));
  }
});
