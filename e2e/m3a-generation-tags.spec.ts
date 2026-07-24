import { test, expect } from '@playwright/test';
import { generateMath } from './helpers/generate';
import { MATH_SKILLS } from '../backend/prisma/seed-skills';
import http from 'http';

// M3a Task 8 (W-38): every generated math question is tagged with a skill from its topic's
// closed list (seed-skills taxonomy). The generator proposes the tag; after the answer-key
// audit passes, a verifier-role call checks the tag against the closed list and its choice
// wins on disagreement. Saving persists the tag as MathQuestion.skillId; saving a question
// with a missing or unknown skillSlug is rejected with 400.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;
const ARITHMETIC_SLUGS = MATH_SKILLS['arithmetic'].map((s) => s.slug);

// Generation returns 5 arithmetic questions: four tagged 'mental-addition-subtraction'
// (which the tag-check verifier confirms) and one [RETAG] question deliberately mistagged
// 'money-calculations' — the verifier answers 'estimation-rounding' for it, so the
// verifier's choice must win.
function startStub(log: { tagChecks: number }): Promise<http.Server> {
  const good = (n: number) => ({
    questionText: `TAGQ${n}: what is ${n * 11} + ${n * 11}?`,
    options: [`${n * 11}`, `${2 * n * 11}`, `${3 * n * 11}`, `${4 * n * 11}`, `${5 * n * 11}`],
    correctIndex: 1,
    explanation: `${n * 11} + ${n * 11} = ${2 * n * 11}. Therefore, the answer is Option B.`,
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
    skillSlug: 'mental-addition-subtraction',
  });
  const retag = {
    questionText: 'RETAG: estimate 4.9 x 61 by rounding both numbers.',
    options: ['250', '300', '350', '400', '450'],
    correctIndex: 1,
    explanation: '5 x 60 = 300. Therefore, the answer is Option B.',
    topicSlug: 'arithmetic',
    topicName: 'Arithmetic',
    skillSlug: 'money-calculations', // valid slug, wrong skill — verifier corrects it
  };
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('audit its answer key')) {
        reply = { correctIndex: 1 }; // answer-key audit: agree with every key
      } else if (content.includes('skill tag')) {
        log.tagChecks++;
        reply = content.includes('RETAG')
          ? { skillSlug: 'estimation-rounding' }
          : { skillSlug: 'mental-addition-subtraction' };
      } else {
        reply = [1, 2, 3, 4].map(good).concat([retag]);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('M3a Task 8 — skill-tagged generation with verifier tag check', () => {
  test('generated questions carry closed-list tags, the verifier overrides a wrong tag, and save persists skillId', async ({ request }) => {
    const log = { tagChecks: 0 };
    const stub = await startStub(log);
    try {
      const result = await generateMath(request, { topicIds: ['arithmetic'], questionCount: 5 });
      expect(result.questions.length).toBe(5);

      // Every generated question is tagged from the topic's closed skill list.
      for (const q of result.questions) {
        expect(ARITHMETIC_SLUGS, `skillSlug "${q.skillSlug}" must come from the arithmetic closed list`).toContain(q.skillSlug);
      }
      // One tag-check verifier call per question, no more (token budget).
      expect(log.tagChecks).toBe(5);
      // The verifier's choice wins over the generator's wrong tag.
      const retagged = result.questions.find((q: any) => q.questionText.startsWith('RETAG'));
      expect(retagged, 'the mistagged question must survive generation').toBeTruthy();
      expect(retagged.skillSlug, "the verifier's tag replaces the generator's").toBe('estimation-rounding');

      // Saving persists each tag as a real skill relation on the question rows.
      const save = await request.post('/api/math/worksheets/save', {
        data: { title: `M3a Tags ${Date.now()}`, topicIds: ['arithmetic'], questions: result.questions },
      });
      expect(save.status()).toBe(201);
      const worksheet = await save.json();

      const rows = await (await request.get(`/api/math/questions?worksheet=${worksheet.id}`)).json();
      expect(rows.length).toBe(5);
      for (const row of rows) {
        expect(row.skill, `question ${row.id} must carry its skill`).toBeTruthy();
        expect(ARITHMETIC_SLUGS, `persisted skill "${row.skill?.slug}" must come from the topic's closed list`).toContain(row.skill.slug);
      }
      const retaggedRow = rows.find((r: any) => r.questionText.startsWith('RETAG'));
      expect(retaggedRow.skill.slug).toBe('estimation-rounding');
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('saving a question with a missing skillSlug is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/math/worksheets/save', {
      data: {
        title: 'M3a missing tag', topicIds: ['arithmetic'],
        questions: [{ questionText: 'What is 2 + 2?', options: ['3', '4', '5', '6', '7'], correctIndex: 1, explanation: 'Two plus two is 4. The answer is Option B.', topicSlug: 'arithmetic' }],
      },
    });
    expect(res.status(), 'a question without skillSlug must be rejected').toBe(400);
  });

  test('saving a question with an unknown skillSlug is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/math/worksheets/save', {
      data: {
        title: 'M3a unknown tag', topicIds: ['arithmetic'],
        questions: [{ questionText: 'What is 3 + 3?', options: ['5', '6', '7', '8', '9'], correctIndex: 1, explanation: 'Three plus three is 6. The answer is Option B.', topicSlug: 'arithmetic', skillSlug: 'not-a-real-skill' }],
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Unknown skill slug');
  });
});
