import { test, expect, APIRequestContext } from '@playwright/test';
import { generateMath } from './helpers/generate';
import http from 'http';

// Model split + verifier pass:
//   - math worksheet generation AND its answer-key verification use the reasoning
//     models split: generation gpt-5-mini, verification o4-mini, analysis gpt-4o-mini;
//   - every generated question's answer key is re-solved independently — questions
//     whose key the solver disputes are dropped and regenerated;
//   - questions with duplicate/equivalent options (e.g. 5/10 vs 25/50) are rejected.

const STUB_PORT = 3106;

interface StubLog {
  generationModels: string[];
  verificationModels: string[];
  analysisModels: string[];
}

// Each generation call returns 6 questions: 4 sound ones, one with a wrong answer
// key ([BADKEY] — claims index 3, truth is index 1), one with duplicate-equivalent
// options ([DUP]). The verification handler always solves honestly: index 1.
function makeGenerationBatch(callNo: number) {
  const good = Array.from({ length: 4 }, (_, i) => {
    const k = callNo * 10 + i + 2;
    return {
      questionText: `What is ${k} + ${k}?`,
      options: [`${k}`, `${2 * k}`, `${3 * k}`, `${4 * k}`, `${5 * k}`],
      correctIndex: 1,
      explanation: `${k} + ${k} = ${2 * k}. Therefore, the answer is Option B.`,
      topicSlug: 'arithmetic',
      topicName: 'Arithmetic',
    };
  });
  const badKey = {
    questionText: `[BADKEY] What is ${callNo} + ${callNo}?`,
    options: [`${callNo}`, `${2 * callNo}`, `${3 * callNo}`, `${4 * callNo}`, `${5 * callNo}`],
    correctIndex: 3, // wrong on purpose — truth is index 1
    explanation: 'Broken key.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  };
  const dup = {
    questionText: `[DUP] What is the probability?`,
    options: ['5/10', '25/50', '2/5', '4/5', '3/5'], // 5/10 === 25/50
    correctIndex: 1,
    explanation: 'Duplicate options.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
  };
  return [...good, badKey, dup];
}

const STUB_ANALYSIS = {
  vocabScore: 70, vocabComments: 'Fine words.', structureScore: 70, structureComments: 'Fine flow.',
  contentScore: 70, contentComments: 'Fine content.', overallScore: 70, summary: 'A fine attempt overall.',
};

function startSmartStub(log: StubLog): Promise<http.Server> {
  let generationCall = 0;
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const parsed = JSON.parse(body);
      const content: string = parsed.messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('independently solving')) {
        log.verificationModels.push(parsed.model);
        reply = { correctIndex: 1 }; // honest solve: truth is always index 1 in this stub
      } else if (content.includes('expert writing tutor')) {
        log.analysisModels.push(parsed.model);
        reply = STUB_ANALYSIS;
      } else {
        log.generationModels.push(parsed.model);
        generationCall++;
        reply = makeGenerationBatch(generationCall);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
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
      text: 'Homework should be limited because rest fuels learning.',
      startedAt: new Date(now - 600_000).toISOString(),
      finishedAt: new Date(now).toISOString(),
      timeTaken: 600,
      source: 'practice',
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()).id;
}

// Milestone 2 B1: these flows create worksheets / load demo data — admin-only routes.
test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('model split + verifier pass', () => {
  test('generation uses gpt-5-mini; verification uses the independent o4-mini; analysis uses gpt-4o-mini', async ({ request }) => {
    const log: StubLog = { generationModels: [], verificationModels: [], analysisModels: [] };
    const stub = await startSmartStub(log);
    try {
      await generateMath(request, { topicIds: ['arithmetic'], questionCount: 8 });

      const attemptId = await createAttempt(request);
      const analysis = await request.post(`/api/analysis/${attemptId}`);
      expect(analysis.ok()).toBeTruthy();

      expect(log.generationModels.length).toBeGreaterThan(0);
      expect(new Set(log.generationModels), 'generation must use gpt-5-mini').toEqual(new Set(['gpt-5-mini']));
      expect(log.verificationModels.length, 'every candidate question must be verified').toBeGreaterThan(0);
      expect(new Set(log.verificationModels), 'verification must use the independent o4-mini').toEqual(new Set(['o4-mini']));
      expect(new Set(log.analysisModels), 'analysis must stay on gpt-4o-mini').toEqual(new Set(['gpt-4o-mini']));
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('questions with wrong answer keys or duplicate options never reach the admin', async ({ request }) => {
    const log: StubLog = { generationModels: [], verificationModels: [], analysisModels: [] };
    const stub = await startSmartStub(log);
    try {
      const body = await generateMath(request, { topicIds: ['arithmetic'], questionCount: 8 });

      expect(body.questions.length, 'must still deliver the exact requested count').toBe(8);
      const texts = body.questions.map((q: any) => q.questionText).join('\n');
      expect(texts, 'wrong-key questions must be dropped by the verifier').not.toContain('[BADKEY]');
      expect(texts, 'duplicate-option questions must be rejected').not.toContain('[DUP]');
      for (const q of body.questions) {
        expect(q.correctIndex, 'every surviving key was independently confirmed').toBe(1);
      }
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
