// W-152: zod schema, validators, and GeneratedMathQuestion mapping for the chart-question
// pipeline. Pure logic — no model calls, no DB. Numeric helpers are imported from ./chart-grid
// (W-151), not redefined here.

import { z } from 'zod';
import {
  round6, approxEq, isMultiple, isClean, fracInInterval, isEasyPosition,
  gridTicks, inferSubdivision, ambiguousValues,
} from './chart-grid';
import type { GridConfig, Difficulty, Subdivision } from './chart-grid';
import type { StimulusSpec } from '../lib/stimulus';

// Local structural type mirroring ai.service.ts's (unexported) GeneratedMathQuestion, to
// avoid importing a non-exported interface / a potential circular import with ai.service.ts.
interface GeneratedMathQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName: string;
  skillSlug: string;
  stimulus?: StimulusSpec;
}

// ── Operations (answer is always recomputed by code) ────────────────────────
export const Operation = z.discriminatedUnion('type', [
  z.object({ type: z.literal('value'), index: z.number().int().nonnegative() }),
  z.object({ type: z.literal('difference'), a: z.number().int().nonnegative(), b: z.number().int().nonnegative() }),
  z.object({ type: z.literal('range') }),
  z.object({ type: z.literal('sum') }),
  z.object({ type: z.literal('mean') }),
]);
export type Operation = z.infer<typeof Operation>;

/** Result in AXIS units. Multiply by cfg.unit for real units. */
export function computeAxis(op: Operation, v: number[]): number {
  switch (op.type) {
    case 'value':      return v[op.index];
    case 'difference': return Math.abs(v[op.a] - v[op.b]);
    case 'range':      return Math.max(...v) - Math.min(...v);
    case 'sum':        return v.reduce((s, x) => s + x, 0);
    case 'mean':       return v.reduce((s, x) => s + x, 0) / v.length;
  }
}

/** Indices whose correct reading determines the answer. */
export function criticalIndices(op: Operation, v: number[]): number[] {
  switch (op.type) {
    case 'value':      return [op.index];
    case 'difference': return [op.a, op.b];
    case 'range':      return [v.indexOf(Math.max(...v)), v.indexOf(Math.min(...v))];
    case 'sum':
    case 'mean':       return v.map((_, i) => i);
  }
}

/** Rough reasoning-step count (a unit conversion adds one). */
export function stepCount(op: Operation, unit: number): number {
  const base = { value: 1, difference: 2, range: 2, sum: 2, mean: 3 }[op.type];
  return base + (unit !== 1 ? 1 : 0);
}

// ── Item schema (what the model must return) ────────────────────────────────
export const ChartSpec = z.object({
  title: z.string().min(1),
  xLabel: z.string().min(1),
  yLabel: z.string().min(1),
  gridStep: z.number().positive(),
  yMax: z.number().positive(),
  labels: z.array(z.string().min(1)).min(3).max(8),
  values: z.array(z.number()).min(3).max(8),
});
export type ChartSpec = z.infer<typeof ChartSpec>;

export const QuestionItem = z.object({
  chart: ChartSpec,
  question_text: z.string().min(10),
  operation: Operation,
  options: z.array(z.object({ value: z.number(), error: z.string().nullable() })).min(4).max(5),
  answer: z.number(),               // real units
  worked_solution: z.string().min(1),
});
export type QuestionItem = z.infer<typeof QuestionItem>;

// ── Misreading traps ────────────────────────────────────────────────────────
// Answers (real units) a student would get by misreading one value as the nearby
// third/quarter position. No distractor may equal one of these.
// NOTE: reconstruct the misread value from the interval BASE (like the W-151
// ambiguousValues fix), not `value - frac*G + alt*G`, to avoid amplified round6 drift.
export function misreadingAnswers(item: QuestionItem, cfg: GridConfig): Set<number> {
  const out = new Set<number>();
  const v = item.chart.values;
  v.forEach((value, i) => {
    const frac = fracInInterval(value, cfg.G);
    if (isEasyPosition(frac)) return;
    const base = Math.floor(round6(value / cfg.G));
    for (const k of [3, 4]) {
      const alt = Math.round(frac * k) / k;
      if (approxEq(alt, frac) || Math.abs(alt - frac) >= 0.1) continue;
      const misread = [...v];
      misread[i] = round6((base + alt) * cfg.G);
      out.add(round6(computeAxis(item.operation, misread) * cfg.unit));
    }
  });
  return out;
}

// ── Leak check: question text must not reveal chart numbers ──────────────────
const numbersIn = (text: string): number[] =>
  (text.replace(/(\d),(\d{3})/g, '$1$2').match(/\d+(?:\.\d+)?/g) ?? []).map(Number);

export function leakedNumbers(item: QuestionItem, cfg: GridConfig): number[] {
  const ticks = gridTicks(cfg.yMax, cfg.G).filter((t) => t !== 0); // NB chart-grid gridTicks is (yMax, G)
  const forbidden = [
    ...ticks,
    ...ticks.map((t) => t * cfg.unit),
    ...item.chart.values,
    ...item.chart.values.map((x) => x * cfg.unit),
  ].filter((x) => x !== 0);
  return numbersIn(item.question_text).filter((n) => forbidden.some((f) => approxEq(f, n)));
}

// ── Full validation ─────────────────────────────────────────────────────────
export interface ValidationResult {
  ok: boolean;
  errors: string[];
  meta?: { subdivision: Subdivision; steps: number; criticalHardValues: number };
}

export function validateItem(raw: unknown, cfg: GridConfig, difficulty: Difficulty): ValidationResult {
  const parsed = QuestionItem.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  const item = parsed.data;
  const { chart } = item;
  const errors: string[] = [];

  // Grid must match what code chose
  if (!approxEq(chart.gridStep, cfg.G)) errors.push(`gridStep must be ${cfg.G}`);
  if (!approxEq(chart.yMax, cfg.yMax)) errors.push(`yMax must be ${cfg.yMax}`);
  if (chart.labels.length !== chart.values.length) errors.push('labels and values differ in length');

  // Values: in range, on the allowed subdivision, clean in real units
  const R = cfg.G / cfg.d;
  chart.values.forEach((v, i) => {
    if (v < 0 || v > cfg.yMax) errors.push(`value ${i} (${v}) outside 0-${cfg.yMax}`);
    if (!isMultiple(v, R)) errors.push(`value ${v} is not on a gridline or a 1/${cfg.d} point`);
    if (!isClean(v, cfg.unit, cfg.cleanStep)) errors.push(`value ${v} is not a clean real-world amount`);
  });

  const inferred = inferSubdivision(cfg.G, chart.values);
  if (inferred === null) errors.push('values need a finer subdivision than quarters');

  const amb = ambiguousValues(chart.values, cfg);
  if (amb.length) errors.push(`values ${amb.join(', ')} could be read as either a third or a quarter`);

  // Operation indices valid
  const op = item.operation;
  const n = chart.values.length;
  if (op.type === 'value' && op.index >= n) errors.push('operation.index out of range');
  if (op.type === 'difference' && (op.a >= n || op.b >= n || op.a === op.b)) errors.push('operation.a/b invalid');
  if (errors.length) return { ok: false, errors };

  // Answer recomputed by code
  const correct = round6(computeAxis(op, chart.values) * cfg.unit);
  if (!approxEq(correct, item.answer)) errors.push(`answer should be ${correct}, got ${item.answer}`);

  // Options
  const values = item.options.map((o) => round6(o.value));
  if (new Set(values).size !== values.length) errors.push('duplicate options');
  const correctOpts = item.options.filter((o) => o.error === null);
  if (correctOpts.length !== 1) errors.push('exactly one option must have error: null');
  else if (!approxEq(correctOpts[0].value, correct)) errors.push('the error:null option is not the correct answer');
  item.options.forEach((o) => {
    if (o.error !== null && !o.error.trim()) errors.push(`option ${o.value} needs a named error`);
  });

  // No option may be reachable purely by a third/quarter misreading
  const traps = misreadingAnswers(item, cfg);
  item.options
    .filter((o) => o.error !== null && traps.has(round6(o.value)))
    .forEach((o) => errors.push(`option ${o.value} only differs by a third/quarter misreading`));

  // Leaks
  const leaks = leakedNumbers(item, cfg);
  if (leaks.length) errors.push(`question_text reveals chart numbers: ${leaks.join(', ')}`);

  // Difficulty
  const steps = stepCount(op, cfg.unit);
  const hardVals = chart.values.filter((v) => !isEasyPosition(fracInInterval(v, cfg.G)));
  const criticalHard = criticalIndices(op, chart.values).filter(
    (i) => !isEasyPosition(fracInInterval(chart.values[i], cfg.G))
  ).length;

  if (difficulty === 'easy' && hardVals.length > 0) errors.push('easy items must use gridlines and halves only');
  if (difficulty === 'medium') {
    if (steps < 2) errors.push('medium items need at least 2 steps');
    if (hardVals.length < 1 || hardVals.length > 2) errors.push('medium items need 1-2 values at a third/quarter position');
  }
  if (difficulty === 'hard') {
    if (steps < 2) errors.push('hard items need at least 2 steps');
    if (criticalHard < 1) errors.push('hard items need an answer-critical value at a third/quarter');
  }

  return errors.length
    ? { ok: false, errors }
    : { ok: true, errors: [], meta: { subdivision: inferred!, steps, criticalHardValues: criticalHard } };
}

// ── Mapping to the app's GeneratedMathQuestion (Task 3 adaptation) ───────────
// options[].value → options: string[]; error:null → correctIndex; worked_solution +
// per-distractor "If you chose X, you …" → explanation; chart → stimulus line/bar figure
// carrying yMax + yTickStep. kind defaults to 'line-chart' (Task 4 threads bar/line through).
export function toGeneratedMathQuestion(
  item: QuestionItem,
  cfg: GridConfig,
  topicName: string,
  kind: 'line-chart' | 'bar-chart' = 'line-chart',
): GeneratedMathQuestion {
  const options = item.options.map((o) => String(o.value));
  const correctIndex = item.options.findIndex((o) => o.error === null);
  const distractorLines = item.options
    .filter((o) => o.error !== null)
    .map((o) => `If you chose ${o.value}, you ${o.error}.`);
  const explanation = [item.worked_solution, ...distractorLines].join(' ');
  const stimulus = {
    version: 1 as const,
    text: '',
    figures: [{
      kind,
      title: item.chart.title,
      xLabel: item.chart.xLabel,
      yLabel: item.chart.yLabel,
      yMax: cfg.yMax,
      yTickStep: cfg.G,
      points: item.chart.labels.map((x, i) => ({ x, y: item.chart.values[i] })),
    }],
  };
  return {
    questionText: item.question_text,
    options,
    correctIndex,
    explanation,
    topicSlug: 'data-interpretation',
    topicName,
    skillSlug: 'bar-and-line-graphs',
    stimulus: stimulus as any, // validateStimulus-compatible; cast to StimulusSpec in the real module
  };
}
