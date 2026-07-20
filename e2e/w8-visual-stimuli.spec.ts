import { test, expect, APIRequestContext } from '@playwright/test';
import { startTest } from './helpers/practice';
import http from 'http';

// W-8: math questions that need a picture (protractor, charts, grids) must carry a
// structured stimulus that the app renders — no more "shown on the protractor below"
// with nothing below. Covers: seed repair, review-page stimulus display, the
// generation guardrail (no visual references without a figure), generated stimuli
// surviving the save→practice path, and chart rendering.

const STUB_PORT = 3106;

const GOOD_Q = (n: number) => ({
  questionText: `What is ${n} + ${n}?`,
  options: [`${n}`, `${2 * n}`, `${3 * n}`, `${4 * n}`, `${5 * n}`],
  correctIndex: 1,
  explanation: `${n} + ${n} = ${2 * n}. Therefore, the answer is Option B.`,
  topicSlug: 'arithmetic',
  topicName: 'Arithmetic',
});

const VISUAL_REF_Q = {
  questionText: 'Using the graph shown below, what is the highest value?',
  options: ['1', '2', '3', '4', '5'],
  correctIndex: 1,
  explanation: 'The graph peaks at 2. Therefore, the answer is Option B.',
  topicSlug: 'arithmetic',
  topicName: 'Arithmetic',
};

const PROTRACTOR_STIMULUS = {
  version: 1,
  text: 'An angle is drawn on the protractor.',
  figures: [{ kind: 'protractor', rays: [30, 110] }],
};

const STIMULUS_Q = {
  questionText: 'Two rays are drawn on the protractor. What is the size of the angle between them?',
  options: ['60°', '70°', '80°', '90°', '100°'],
  correctIndex: 2,
  explanation: '110° − 30° = 80°. Therefore, the answer is Option C.',
  topicSlug: 'arithmetic',
  topicName: 'Arithmetic',
  stimulus: PROTRACTOR_STIMULUS,
};

interface StubState {
  generationCalls: number;
  verificationBodies: string[];
  firstBatch: unknown[];
  laterBatch: unknown[];
}

function startStub(state: StubState): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('independently solving')) {
        state.verificationBodies.push(content);
        // Honest solver: every stub question's true answer is index 2 for the
        // stimulus question, index 1 otherwise.
        reply = { correctIndex: content.includes('protractor') ? 2 : 1 };
      } else {
        state.generationCalls++;
        reply = state.generationCalls === 1 ? state.firstBatch : state.laterBatch;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

async function saveAndStart(page: any, request: APIRequestContext, title: string, questions: unknown[]) {
  const save = await request.post('/api/math/worksheets/save', {
    data: { title, topicIds: ['arithmetic'], questions },
  });
  expect(save.status()).toBe(201);
  await page.goto('/dashboard');
  const panel = page.locator('section', { hasText: 'Pending Worksheets' });
  // Each pending row is the justify-between flex div; scope Start to exactly our row.
  await panel
    .locator('div.justify-between')
    .filter({ hasText: title })
    .getByRole('button', { name: 'Start', exact: true })
    .click();
  await startTest(page);
  await expect(page.getByText(/^\d+ \/ \d+$/)).toBeVisible();
}

// Milestone 2 B1: these flows create worksheets / load demo data — admin-only routes.
test.use({ storageState: 'e2e/.auth/admin.json' });

test.describe('W-8 — visual stimuli for math questions', () => {
  test('seeded protractor questions render a real protractor figure', async ({ page }) => {
    await page.goto('/math/protractor-skills/start');
    await startTest(page);
    // The reported bug: "Two triangles are shown on the protractor below" with nothing below.
    await expect(page.getByTestId('stimulus-protractor')).toBeVisible();
  });

  test('the attempt review page shows the question stimulus', async ({ page, request }) => {
    const questions = await (await request.get('/api/math/questions?topic=protractor-skills')).json();
    expect(questions.length).toBeGreaterThanOrEqual(1);
    const qIds = questions.map((q: any) => q.id);
    const created = await request.post('/api/math/attempts', {
      data: {
        topicId: questions[0].topicId,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(questions.map(() => 0)),
        startedAt: new Date(Date.now() - 120_000).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: 120,
        source: 'practice',
      },
    });
    expect(created.status()).toBe(201);
    const attempt = await created.json();

    await page.goto(`/math-attempt/${attempt.id}`);
    // Review must show what the student saw — today it renders no stimulus at all.
    await expect(page.getByTestId('stimulus-protractor').first()).toBeVisible();
  });

  test('generation discards questions that reference visuals without a figure', async ({ request }) => {
    const state: StubState = {
      generationCalls: 0,
      verificationBodies: [],
      firstBatch: [VISUAL_REF_Q, GOOD_Q(3)],
      laterBatch: [GOOD_Q(4), GOOD_Q(5), GOOD_Q(6)],
    };
    const stub = await startStub(state);
    try {
      const res = await request.post('/api/math/worksheets/generate', {
        data: { topicIds: ['arithmetic'], questionCount: 5 },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.questions.length).toBe(5);
      for (const q of body.questions) {
        const referencesVisual = /(shown|below|above|diagram|figure|picture|graph|chart|protractor|image)/i.test(q.questionText);
        expect(referencesVisual && !q.stimulus, `unanswerable question slipped through: "${q.questionText}"`).toBeFalsy();
      }
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('a generated stimulus is verified against, saved, and rendered in practice', async ({ page, request }) => {
    const state: StubState = {
      generationCalls: 0,
      verificationBodies: [],
      firstBatch: [STIMULUS_Q, GOOD_Q(7), GOOD_Q(8), GOOD_Q(9), GOOD_Q(11)],
      laterBatch: [GOOD_Q(12), GOOD_Q(13)],
    };
    const stub = await startStub(state);
    try {
      const res = await request.post('/api/math/worksheets/generate', {
        data: { topicIds: ['arithmetic'], questionCount: 5 },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      const withStimulus = body.questions.find((q: any) => q.stimulus);
      expect(withStimulus, 'generated stimulus must survive into the response').toBeTruthy();
      expect(withStimulus.stimulus.figures[0].kind).toBe('protractor');

      // The verifier must re-solve from what the student will see: the audit call
      // for the stimulus question must include the figure data.
      const audited = state.verificationBodies.some((b) => b.includes('"rays"'));
      expect(audited, 'verifier prompt must carry the stimulus JSON').toBeTruthy();

      const title = `E2E W8 Stimulus ${Date.now()}`;
      await saveAndStart(page, request, title, body.questions);
      // The stimulus question may not be first — walk questions until the figure shows.
      for (let i = 0; i < body.questions.length; i++) {
        if (await page.getByTestId('stimulus-protractor').isVisible()) break;
        await page.getByRole('button', { name: 'Next' }).click();
      }
      await expect(page.getByTestId('stimulus-protractor')).toBeVisible();
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });

  test('a saved line-chart figure renders as a real chart in practice', async ({ page, request }) => {
    const chartQ = {
      questionText: 'According to the chart, at what time was the distance greatest?',
      options: ['9 am', '11 am', '1 pm', '3 pm', '5 pm'],
      correctIndex: 3,
      explanation: 'The line peaks at 3 pm. Therefore, the answer is Option D.',
      topicSlug: 'arithmetic',
      topicName: 'Arithmetic',
      stimulus: {
        version: 1,
        text: 'The line graph shows distance travelled during the day.',
        figures: [{
          kind: 'line-chart',
          title: 'Distance travelled',
          xLabel: 'Time',
          yLabel: 'km',
          points: [
            { x: '9 am', y: 0 }, { x: '11 am', y: 4 }, { x: '1 pm', y: 9 },
            { x: '3 pm', y: 14 }, { x: '5 pm', y: 6 },
          ],
        }],
      },
    };
    const title = `E2E W8 Chart ${Date.now()}`;
    await saveAndStart(page, request, title, [chartQ]);
    await expect(page.getByTestId('stimulus-line-chart')).toBeVisible();
    // A real chart, not prose: Recharts renders an SVG inside the figure.
    await expect(page.getByTestId('stimulus-line-chart').locator('svg').first()).toBeVisible();
  });
});
