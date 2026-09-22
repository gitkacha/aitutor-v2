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

// ── Prompt for the generation model (Task 4) ─────────────────────────────────
// The grid (gridStep, yMax, gridlines) is FIXED by code (chart-grid.ts's pickGrid) so a
// generated chart is always readable — the model must describe data that fits this grid,
// never invent or restate its own. It must also never leak a data value, gridline value,
// or axis number in the question stem (leakedNumbers() enforces this at validation time).
const FRACTION_WORD: Record<Subdivision, string> = {
  1: 'gridline only (no fractional positions)',
  2: 'gridline or exact half-way point',
  3: 'gridline or exact third (1/3, 2/3) of a grid interval',
  4: 'gridline or exact quarter (1/4, 1/2, 3/4) of a grid interval',
};

export function buildChartPrompt(cfg: GridConfig, difficulty: Difficulty, kind: 'line-chart' | 'bar-chart'): string {
  const ticks = gridTicks(cfg.yMax, cfg.G).join(', ');
  const difficultyGuidance = {
    easy: 'Every plotted value must sit exactly ON a gridline or exactly halfway between two gridlines.',
    medium: '1-2 plotted values must sit at a third/quarter position on the grid (per the allowed subdivision below); the rest on a gridline or halfway. The question must take at least 2 reasoning steps (e.g. a difference, range, sum, or mean, plus the unit conversion if any).',
    hard: 'At least one of the values that is CRITICAL to computing the answer must sit at a third/quarter position on the grid (not just a decorative one). The question must take at least 2 reasoning steps.',
  }[difficulty];

  return `You are writing ONE multiple-choice "read a ${kind}" data-interpretation question for a Year 6 student preparing for the NSW Selective High School Placement Test.

FIXED GRID — DO NOT CHANGE. The chart's grid has already been chosen by code so the chart is always readable. You must use EXACTLY this grid:
- gridStep = ${cfg.G} (the spacing between gridlines, in axis units)
- yMax = ${cfg.yMax} (the top of the y-axis, in axis units)
- gridlines are at: ${ticks}
- one axis unit = ${cfg.unit} real unit(s) (e.g. the axis is in "hundreds" if unit = 100)
- allowed value positions: each plotted value must sit on a ${FRACTION_WORD[cfg.d]}

Do not change the grid, invent a different gridStep or yMax, or restate the gridline values anywhere in your output text — echo gridStep/yMax back ONLY in the "chart" JSON fields, never in prose.

DIFFICULTY (${difficulty}): ${difficultyGuidance}

DATA. Invent a short, natural title, axis labels, 3-8 category labels (e.g. days of the week, months, names) and one plotted value per label, each obeying the FIXED GRID above and clean once converted to real units (a multiple of ${cfg.cleanStep} real unit(s)).

QUESTION TEXT — DO NOT LEAK THE CHART. Refer to "the chart" (or "the graph") generically. Do NOT write any data value, gridline value, or axis number anywhere in the question_text — the student must read every number from the rendered chart, not from your words. Ask a genuine multi-step question: a difference between two categories, the range, a sum, or a mean — not a single direct lookup.

OPERATION. Set "operation" to exactly one of:
- {"type":"value","index":<int>} — reads a single plotted value
- {"type":"difference","a":<int>,"b":<int>} — |values[a] - values[b]|
- {"type":"range"} — max - min
- {"type":"sum"} — sum of all values
- {"type":"mean"} — average of all values

ANSWER & OPTIONS. Give the correct "answer" in REAL units (axis value × ${cfg.unit}). Provide 4-5 "options", each {"value": <number in real units>, "error": <string naming the exact misreading/miscalculation that produces it, or null for the single correct option>}. Exactly one option must have "error": null and its value must equal the correct answer. Every wrong option must name a plausible, specific mistake (e.g. "read the wrong bar", "used only the largest value", "forgot to convert to real units") — never a generic label. Do NOT include a distractor reachable only by misreading a value as a third instead of a quarter (or vice versa) — that ambiguity is checked and rejected.

Respond with ONLY a JSON object (no markdown, no code fences) in this exact shape:
{
  "chart": {"title": "...", "xLabel": "...", "yLabel": "...", "gridStep": ${cfg.G}, "yMax": ${cfg.yMax}, "labels": ["...", ...], "values": [<numbers in axis units>, ...]},
  "question_text": "...",
  "operation": {"type": "..."},
  "answer": <number, real units>,
  "options": [{"value": <number>, "error": <string or null>}, ...],
  "worked_solution": "Step-by-step reasoning a Year 6 student could redo in their head, ending in the answer."
}`;
}

// ── Model-driven generation with validation retry (Task 4) ───────────────────
function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (fenced ? fenced[1] : text).trim();
}

export async function generateChartQuestion(
  cfg: GridConfig,
  difficulty: Difficulty,
  kind: 'line-chart' | 'bar-chart',
  callModel: (prompt: string) => Promise<string>,
  maxAttempts = 4,
): Promise<GeneratedMathQuestion> {
  let prompt = buildChartPrompt(cfg, difficulty, kind);
  let lastErrors: string[] = ['no attempts made'];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reply = await callModel(prompt);
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(reply));
    } catch {
      lastErrors = ['response was not valid JSON'];
      prompt = `${buildChartPrompt(cfg, difficulty, kind)}\n\nYour previous reply could not be parsed as JSON. Respond with ONLY the JSON object, no markdown or commentary.`;
      continue;
    }
    const result = validateItem(parsed, cfg, difficulty);
    if (result.ok) {
      return toGeneratedMathQuestion(parsed as QuestionItem, cfg, 'Data Interpretation', kind);
    }
    lastErrors = result.errors;
    prompt = `${buildChartPrompt(cfg, difficulty, kind)}\n\nYour previous reply had these problems — fix ALL of them and respond again with ONLY the corrected JSON object:\n${result.errors.map((e) => `- ${e}`).join('\n')}`;
  }
  throw new Error(`generateChartQuestion: failed after ${maxAttempts} attempts: ${lastErrors.join('; ')}`);
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
  const stimulus: StimulusSpec = {
    version: 1,
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
    stimulus,
  };
}
