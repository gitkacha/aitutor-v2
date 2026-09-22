import { test, expect } from '@playwright/test';
import { generateMath } from './helpers/generate';
import http from 'http';

// W-154: the code-owns-the-grid chart pipeline (chart-grid.ts pickGrid + chart-question.ts
// generateChartQuestion/validateItem, wired into generateMathWorksheetQuestions at W-153) must
// produce, inside a Data Interpretation worksheet, at least one line/bar chart question that (a)
// renders with an EXPLICIT axis (yMax + yTickStep, so the frontend draws exact gridlines instead
// of guessing "nice" ticks) and (b) leaks no plotted/gridline value in its question stem.
//
// The chart-question generation call is a DIFFERENT prompt from the batch generation call:
// buildChartPrompt() states a grid the code already chose ("gridStep = ...", "yMax = ...") and
// the model must describe data that fits it. The stub below parses that grid back out of the
// prompt text and echoes a deterministically-valid QuestionItem — verified by brute-forcing every
// (gridStep, subdivision, yMax, unit) combination pickGrid can produce for medium/hard difficulty
// against the real validateItem() (see chart-question.ts) before relying on it here.

test.use({ storageState: 'e2e/.auth/admin.json' });

const STUB_PORT = 3106;

// Batch top-up path (the non-chart share of the DI worksheet): a handful of ordinary, valid
// 5-option DI questions with no stimulus — mirrors e2e/math-topic-briefs.spec.ts's `good()`.
const good = (n: number) => ({
  questionText: `DIQ${n}: a value increases from ${n} to ${n + 4}; what is the total increase?`,
  options: ['4', '3', '5', '2', '6'],
  correctIndex: 0,
  explanation: `${n + 4} - ${n} = 4. Therefore, the answer is Option A.`,
  topicSlug: 'data-interpretation',
  topicName: 'Data Interpretation',
  skillSlug: 'bar-and-line-graphs',
});

// Build a QuestionItem (chart-question.ts's QuestionItem zod shape) that satisfies validateItem()
// for the grid stated in the chart-question prompt, whatever difficulty/subdivision/unit code
// picked at runtime. Uses operation:{type:'difference'} (always >=2 steps, satisfying both medium
// and hard's step-count rule) with one value on a gridline and one value at the subdivision's
// off-gridline fraction (third or quarter — whichever the prompt's FIXED GRID states), which is
// also the answer-critical value (satisfying hard's "critical value off-gridline" rule) while
// staying within medium's "1-2 off-gridline values" rule (exactly one here).
function buildChartItem(prompt: string) {
  const G = Number(prompt.match(/gridStep = (\d+(?:\.\d+)?)/)![1]);
  const yMax = Number(prompt.match(/yMax = (\d+(?:\.\d+)?)/)![1]);
  const unitMatch = prompt.match(/one axis unit = (\d+(?:\.\d+)?) real unit/);
  const unit = unitMatch ? Number(unitMatch[1]) : 1;
  const frac = /exact third/.test(prompt) ? 1 / 3 : /exact quarter/.test(prompt) ? 1 / 4 : 0.5;

  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const gridVal = G; // on a gridline
  const offVal = Math.round(G * (1 + frac) * 1e6) / 1e6; // off-gridline, inside [G, 2G)
  const values = [gridVal, offVal, G * 2, G * 3, gridVal];
  const diff = Math.round(Math.abs(offVal - gridVal) * 1e6) / 1e6;
  const kind = /bar-chart/.test(prompt) ? 'bar-chart' : 'line-chart';

  return {
    chart: {
      title: 'Weekly Visitors',
      xLabel: 'Day',
      yLabel: 'Visitors',
      gridStep: G,
      yMax,
      labels,
      values,
    },
    question_text: 'The chart shows daily visitors. How many more visitors were there on Tuesday than on Monday?',
    operation: { type: 'difference', a: 1, b: 0 },
    options: [
      { value: diff * unit, error: null },
      { value: gridVal * unit, error: 'read the wrong day' },
      { value: G * 2 * unit, error: 'used the peak' },
      { value: 0, error: 'misread the axis' },
    ],
    answer: diff * unit,
    worked_solution: 'Subtract Monday from Tuesday.',
    _kind: kind, // not part of QuestionItem — unused by the app, harmless extra field for debugging
  };
}

function startStub(log: { chartCalls: number; batchCalls: number }): Promise<http.Server> {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const content: string = JSON.parse(body).messages?.[0]?.content || '';
      let reply: unknown;
      if (content.includes('gridStep =')) {
        log.chartCalls++;
        reply = buildChartItem(content);
      } else if (content.includes('audit its answer key')) {
        reply = { correctIndex: 0 };
      } else if (content.includes('skill tag')) {
        reply = { skillSlug: 'bar-and-line-graphs' };
      } else {
        log.batchCalls++;
        reply = [1, 2, 3, 4, 5, 6].map(good);
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(reply) } }] }));
    });
  });
  return new Promise((resolve) => server.listen(STUB_PORT, '127.0.0.1', () => resolve(server)));
}

test.describe('W-154 — DI chart question pipeline e2e', () => {
  test('generated DI worksheet includes a code-owned-grid chart question with explicit ticks and no leaked values', async ({ request }) => {
    const log = { chartCalls: 0, batchCalls: 0 };
    const stub = await startStub(log);
    try {
      const result = await generateMath(request, { topicIds: ['data-interpretation'], questionCount: 6 });
      expect(result.questions.length).toBe(6);
      expect(log.chartCalls, 'the chart-question pipeline must have been invoked').toBeGreaterThan(0);

      const chartQuestions = result.questions.filter(
        (q: any) => q.stimulus?.figures?.some((f: any) => (f.kind === 'line-chart' || f.kind === 'bar-chart') && f.yTickStep)
      );
      expect(chartQuestions.length, 'at least one question must carry a code-owned-grid line/bar figure').toBeGreaterThan(0);

      for (const q of chartQuestions) {
        const figure = q.stimulus.figures.find((f: any) => f.kind === 'line-chart' || f.kind === 'bar-chart');
        // Explicit render: the figure carries a fixed yMax + yTickStep (so the frontend draws
        // exact gridlines from code, rather than inferring "nice" ticks from arbitrary data).
        expect(figure.yMax, 'chart figure must carry yMax').toBeGreaterThan(0);
        expect(figure.yTickStep, 'chart figure must carry yTickStep').toBeGreaterThan(0);
        expect(Number.isFinite(figure.yMax / figure.yTickStep)).toBe(true);

        // Leak check: the question stem must never state a plotted value, gridline value, or
        // axis number — the student must read every number off the rendered chart.
        expect(q.questionText, 'chart question stem must not leak a numeric value').not.toMatch(/\d/);
      }
    } finally {
      await new Promise((r) => stub.close(r));
    }
  });
});
