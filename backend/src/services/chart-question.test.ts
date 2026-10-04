import { describe, it, expect } from 'vitest';
import { validateItem, toGeneratedMathQuestion, generateChartQuestion, buildChartPrompt } from './chart-question';
import type { GridConfig } from './chart-grid';

// Axis in hundreds (unit=100), gridlines every 2 (→ 200 visitors), quarters allowed (d=4 → 0.5 = 50).
const cfg: GridConfig = { G: 2, d: 4, yMax: 8, unit: 100, cleanStep: 25 };

// Mon..Fri, values in axis units; 2.5 and 5.5 are clean quarter/half positions (250, 550 real).
const goodItem = () => ({
  chart: { title: 'Daily visitors', xLabel: 'Day', yLabel: 'Hundreds of visitors',
           gridStep: 2, yMax: 8, labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values: [2, 4, 2.5, 6, 5.5] },
  question_text: 'The chart shows museum visitors each day. What is the range of visitors during the week?',
  operation: { type: 'range' as const },
  // range = 6 - 2 = 4 axis → 400 real
  options: [
    { value: 400, error: null },
    { value: 350, error: 'read Wed as a third instead of a quarter' },
    { value: 600, error: 'used the largest value only' },
    { value: 200, error: 'forgot to convert hundreds' },
  ],
  answer: 400,
  worked_solution: 'Max 6, min 2, range 4 → 400.',
});

describe('validateItem', () => {
  it('accepts a correct, readable, leak-free item', () => {
    const r = validateItem(goodItem(), cfg, 'medium');
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
  });
  it('rejects a leaked chart number in the stem', () => {
    const item = goodItem();
    item.question_text = 'Visitors were 200, 400, 250, 600, 550. What is the range?';
    expect(validateItem(item, cfg, 'medium').ok).toBe(false);
  });
  it('rejects a wrong (code-recomputed) answer', () => {
    const item = goodItem(); item.answer = 500; item.options[0].value = 500;
    expect(validateItem(item, cfg, 'medium').ok).toBe(false);
  });
  it('rejects a value off the allowed 1/d fraction', () => {
    const item = goodItem(); item.chart.values = [2, 4, 1.65, 6, 5.5]; // 1.65 not a quarter of 2
    expect(validateItem(item, cfg, 'medium').ok).toBe(false);
  });
});

describe('toGeneratedMathQuestion', () => {
  it('maps options/correctIndex/explanation/stimulus into the app shape', () => {
    const q = toGeneratedMathQuestion(goodItem(), cfg, 'Data Interpretation');
    expect(q.options).toHaveLength(4);
    expect(q.correctIndex).toBe(0);
    expect(q.options[q.correctIndex]).toContain('400');
    expect(q.stimulus).toMatchObject({ figures: [{ kind: 'line-chart', yMax: 8, yTickStep: 2 }] });
    expect(q.explanation.toLowerCase()).toContain('if you chose'); // per-distractor error names
    expect(q.topicSlug).toBe('data-interpretation');
  });
});

describe('buildChartPrompt', () => {
  it('states the fixed grid and forbids describing/leaking it', () => {
    const p = buildChartPrompt({ G: 2, d: 4, yMax: 8, unit: 100, cleanStep: 25 }, 'hard', 'line-chart');
    expect(p).toContain('gridStep = 2');
    expect(p).toContain('yMax = 8');
    expect(p.toLowerCase()).toContain('do not write any data value');
    expect(p.toLowerCase()).toContain('do not change'); // grid is fixed
  });
});

describe('generateChartQuestion', () => {
  it('retries on an invalid model reply and returns a mapped question on success', async () => {
    const cfg = { G: 2, d: 4, yMax: 8, unit: 100, cleanStep: 25 } as const;
    const valid = {
      chart: { title: 'Daily visitors', xLabel: 'Day', yLabel: 'Hundreds of visitors',
               gridStep: 2, yMax: 8, labels: ['Mon','Tue','Wed','Thu','Fri'], values: [2,4,2.5,6,5.5] },
      question_text: 'The chart shows museum visitors each day. What is the range of visitors?',
      operation: { type: 'range' }, answer: 400,
      options: [{ value: 400, error: null }, { value: 350, error: 'read Wed as a third not a quarter' },
                { value: 600, error: 'used the largest only' }, { value: 200, error: 'forgot to convert hundreds' }],
      worked_solution: 'Max 6, min 2 → 4 → 400.',
    };
    let call = 0;
    const stub = async () => (++call === 1 ? 'not json' : JSON.stringify(valid));
    const q = await generateChartQuestion(cfg, 'medium', 'line-chart', stub, 4);
    expect(call).toBe(2);
    expect(q.correctIndex).toBe(0);
    expect(q.stimulus).toMatchObject({ figures: [{ kind: 'line-chart', yMax: 8 }] });
  });
});

// W-156: chart answers must be mentally checkable — never a repeating/long decimal.
describe('validateItem — answer decimal precision', () => {
  const cfg = { G: 2, d: 4, yMax: 8, unit: 100, cleanStep: 25 } as const;
  // mean of these six axis values = 23/6 = 3.8333… → ×100 = 383.33… (repeating, >2dp).
  const uglyMeanItem = () => ({
    chart: { title: 'Books', xLabel: 'Day', yLabel: 'Hundreds', gridStep: 2, yMax: 8,
             labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], values: [2, 4, 2.5, 6, 5.5, 3] },
    question_text: 'The chart shows books borrowed. What was the average per day?',
    operation: { type: 'mean' as const },
    answer: 383.333333,
    options: [
      { value: 383.333333, error: null },
      { value: 38.33, error: 'forgot to convert to real units' },
      { value: 460, error: 'divided by five instead of six' },
      { value: 230, error: 'used only one day' },
    ],
    worked_solution: 'Add all six and divide by six.',
  });

  it('rejects an answer that needs more than 2 decimal places', () => {
    const r = validateItem(uglyMeanItem(), cfg, 'medium');
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => /decimal/i.test(e))).toBe(true);
  });
});

describe('toGeneratedMathQuestion — value formatting', () => {
  const cfg = { G: 2, d: 4, yMax: 8, unit: 100, cleanStep: 25 } as const;
  it('formats option values and explanation references to at most 2 decimals', () => {
    const item = {
      chart: { title: 'Books', xLabel: 'Day', yLabel: 'Hundreds', gridStep: 2, yMax: 8,
               labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], values: [2, 4, 2.5, 6, 5.5] },
      question_text: 'The chart shows books borrowed. What was the average per day?',
      operation: { type: 'mean' as const },
      answer: 400,
      options: [
        { value: 195.83333333333334, error: null },
        { value: 191.66666666666666, error: 'misread Tuesday' },
        { value: 235, error: 'divided by five' },
        { value: 206.25, error: 'averaged only Monday to Thursday' },
      ],
      worked_solution: 'Add and divide.',
    };
    const q = toGeneratedMathQuestion(item as any, cfg, 'Data Interpretation', 'line-chart');
    expect(q.options).toEqual(['195.83', '191.67', '235', '206.25']);
    expect(q.explanation).toContain('If you chose 191.67');
    expect(q.explanation).not.toMatch(/191\.6{4}/); // no long-decimal tail
  });
});
