# Code-Owned Grid Chart-Question Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For Data Interpretation line/bar-chart questions, have CODE choose a safe, readable grid and validate everything (readability, third/quarter ambiguity, value leaks, code-recomputed answer, misreading-trap distractors), so generated charts are readable, contradiction-free, and leak-free.

**Architecture:** Code picks a safe `(G, subdivision d, yMax, unit)` grid; the model writes values/text/operation/options within that fixed grid; code validates and recomputes the answer; the chart renders with an explicit YAxis domain+ticks. Output maps into the app's existing `GeneratedMathQuestion` shape and save path. Only DI line/bar charts use this path; pie/table and other topics are unchanged.

**Tech Stack:** TypeScript, zod (new backend dep), Vitest, Playwright, Recharts, Express, Prisma.

## Global Constraints

- Worksheets only — do NOT modify `coaching.service.ts` (lesson) prompts or figures.
- Chart scope: **line + bar** charts for `data-interpretation` only. Pie, table, and every other topic keep the current generation path.
- The model NEVER chooses the grid — code picks `(G, d, yMax, unit)` and passes it as a fixed constraint. The generated chart's `gridStep`/`yMax` must equal what code chose or the item is rejected.
- Every value the student reads must sit on a gridline or the allowed 1/d fraction of an interval, be clean in REAL units (`value * unit` a multiple of `cleanStep`), and carry no third-vs-quarter ambiguity.
- The question text must not contain any chart number (gridline value or data value, in axis OR real units) — a leak check enforces this.
- The answer is recomputed by code; exactly one option has `error: null` and equals it; no distractor may be reachable purely by a third/quarter misreading.
- Adopt real-units vs axis-units (`unit` multiplier + `cleanStep`).
- Reuse the existing `StimulusFigure` renderer and `GeneratedMathQuestion` shape — no parallel renderer or question format.
- Numeric tolerance `TOL = 1e-6`; `round6(x) = Math.round(x*1e6)/1e6`.

## Worklog items (create in `docs/worklog.md` before Task 1)

```markdown
- [ ] W-150: Line/bar chart figures support an explicit y-axis (yMax + yTickStep) — schema + validateStimulus + StimulusFigure renders domain+ticks; auto-scale fallback when absent; unit-tested
- [ ] W-151: backend chart-grid.ts numeric core (isMultiple/fracInInterval/isClean/safeGridPairs/pickGrid/gridTicks/inferSubdivision/ambiguousValues); code owns the safe grid; unit-tested
- [ ] W-152: backend chart-question.ts zod schema + validators (computeAxis/misreadingAnswers/leakedNumbers/validateItem) + toGeneratedMathQuestion mapping; unit-tested
- [ ] W-153: chart-question generator (buildChartPrompt + generateChartQuestion retry loop) wired into DI line/bar generation, replacing the LLM answer audit for these code-validated questions; unit-tested with a stub model
- [ ] W-154: e2e — admin generates a DI worksheet whose chart question renders explicit ticks and leaks no values
```

## File Structure

- **Modify** `frontend/src/lib/stimulus.ts` — add `yMax?`/`yTickStep?` to `LineChartFigure`/`BarChartFigure`; validate them.
- **Modify** `frontend/src/components/StimulusFigure.tsx` — explicit `domain`+`ticks` for line/bar when set.
- **Create** `frontend/src/lib/chart-ticks.ts` (+ test) — shared `gridTicks` helper for the renderer.
- **Create** `backend/src/services/chart-grid.ts` (+ test) — pure numeric grid core.
- **Create** `backend/src/services/chart-question.ts` (+ test) — schema, validators, prompt, generator, mapping.
- **Modify** `backend/src/services/ai.service.ts` — route DI line/bar questions through the pipeline.
- **Create** `e2e/chart-question-pipeline.spec.ts`.
- **Modify** `backend/package.json` — add `zod`.

---

### Task 1: Explicit-axis schema + renderer (W-150)

**Files:**
- Create: `frontend/src/lib/chart-ticks.ts`, `frontend/src/lib/chart-ticks.test.ts`
- Modify: `frontend/src/lib/stimulus.ts` (LineChartFigure ~L26, BarChartFigure ~L34, validation ~L171)
- Modify: `frontend/src/components/StimulusFigure.tsx` (line/bar case ~L371-392)

**Interfaces:**
- Produces: `gridTicks(yMax: number, step: number): number[]` (`[0, step, 2*step, … yMax]`); optional `yMax`/`yTickStep` on line/bar figures.

- [ ] **Step 1: Write the failing test** — `frontend/src/lib/chart-ticks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { gridTicks } from './chart-ticks';

describe('gridTicks', () => {
  it('builds inclusive ticks from 0 to yMax at the given step', () => {
    expect(gridTicks(8, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(gridTicks(9, 3)).toEqual([0, 3, 6, 9]);
  });
  it('returns [0] when the step is not positive or does not divide yMax cleanly', () => {
    expect(gridTicks(8, 0)).toEqual([0]);
    expect(gridTicks(10, 3)).toEqual([0]); // 10/3 not integer → unusable, degrade to [0]
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd frontend && npx vitest run src/lib/chart-ticks.test.ts` → module not found.

- [ ] **Step 3: Create `frontend/src/lib/chart-ticks.ts`:**

```ts
// W-150: inclusive y-axis ticks [0, step, 2*step, … yMax] for an explicit chart axis. Degrades to
// [0] when the step is unusable so a bad figure never throws in render.
export function gridTicks(yMax: number, step: number): number[] {
  if (!(step > 0) || !(yMax > 0)) return [0];
  const n = yMax / step;
  if (Math.abs(n - Math.round(n)) > 1e-9) return [0];
  return Array.from({ length: Math.round(n) + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
}
```

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Extend the schema.** In `frontend/src/lib/stimulus.ts`, add `yMax?: number; yTickStep?: number;` to BOTH `LineChartFigure` and `BarChartFigure` (after `points`). Extend the `line-chart`/`bar-chart` validation case to accept them:

```ts
    case 'line-chart':
    case 'bar-chart': {
      const pointsOk =
        Array.isArray(f.points) && f.points.length >= 2 &&
        f.points.every((p: any) => p && (typeof p.x === 'string' || isFiniteNumber(p.x)) && isFiniteNumber(p.y));
      if (!pointsOk) return false;
      // W-150: optional explicit axis — both present, positive, yMax a multiple of the step.
      const hasAxis = f.yMax !== undefined || f.yTickStep !== undefined;
      if (hasAxis) {
        if (!isFiniteNumber(f.yMax) || !isFiniteNumber(f.yTickStep) || f.yMax <= 0 || f.yTickStep <= 0) return false;
        const n = f.yMax / f.yTickStep;
        if (Math.abs(n - Math.round(n)) > 1e-9) return false;
      }
      return true;
    }
```

- [ ] **Step 6: Render explicit ticks.** In `frontend/src/components/StimulusFigure.tsx`, import `gridTicks` from `@/lib/chart-ticks`. In the `line-chart`/`bar-chart` case, compute once inside the case body:

```ts
        const axis = (figure.yMax && figure.yTickStep)
          ? { domain: [0, figure.yMax] as [number, number], ticks: gridTicks(figure.yMax, figure.yTickStep) }
          : {};
```

Add `domain`/`ticks` to BOTH `<YAxis>` elements (line and bar) via `{...(axis.ticks ? { domain: axis.domain, ticks: axis.ticks, allowDecimals: true } : {})}`. When absent, behaviour is unchanged (auto-scale).

- [ ] **Step 7: Run the full frontend suite** — `cd frontend && npx vitest run` → all pass.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/lib/chart-ticks.ts frontend/src/lib/chart-ticks.test.ts frontend/src/lib/stimulus.ts frontend/src/components/StimulusFigure.tsx docs/worklog.md
git commit -m "feat(W-150): explicit y-axis (yMax/yTickStep) for line/bar chart figures

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `chart-grid.ts` numeric core (W-151)

**Files:**
- Create: `backend/src/services/chart-grid.ts`, `backend/src/services/chart-grid.test.ts`

**Interfaces:**
- Produces: `TOL`, `round6`, `approxEq`, `isMultiple`, `fracInInterval`, `isEasyPosition`, `isClean`, `rivalOf`, `safeGridPairs`, `pickGrid`, `gridTicks`, `inferSubdivision`, `ambiguousValues`; types `Subdivision`, `Difficulty`, `GridConfig`.

- [ ] **Step 1: Write the failing test** — `backend/src/services/chart-grid.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isMultiple, fracInInterval, isClean, safeGridPairs, pickGrid, gridTicks, inferSubdivision } from './chart-grid';

describe('chart-grid numeric core', () => {
  it('isMultiple / fracInInterval', () => {
    expect(isMultiple(6, 2)).toBe(true);
    expect(isMultiple(7, 2)).toBe(false);
    expect(fracInInterval(3, 2)).toBeCloseTo(0.5); // 3 is halfway in a step-2 grid
    expect(fracInInterval(4, 2)).toBeCloseTo(0);
  });
  it('isClean converts to real units first', () => {
    expect(isClean(0.5, 100, 1)).toBe(true);   // 0.5 hundreds = 50 → clean
    expect(isClean(0.5, 1, 1)).toBe(false);     // 0.5 in whole units → not clean
  });
  it('safeGridPairs — whole-number units (unit=1, cleanStep=1): a fraction G/d must itself be a whole number', () => {
    const pairs = safeGridPairs([2, 3, 4, 9, 10, 12, 20, 24], 1, 1);
    const has = (G: number, d: number) => pairs.some((p) => p.G === G && p.d === d);
    // thirds where G/3 is whole and G/4 is NOT also clean:
    expect(has(3, 3)).toBe(true);   // 3/3 = 1
    expect(has(9, 3)).toBe(true);   // 9/3 = 3
    // quarters require G divisible by 4 (G/4 whole). NOT G=2 (0.5) or G=10 (2.5):
    expect(has(2, 4)).toBe(false);
    expect(has(10, 4)).toBe(false);
    expect(has(4, 4)).toBe(true);   // 4/4 = 1
    expect(has(20, 4)).toBe(true);  // 20/4 = 5
    // G=12 and 24: thirds AND quarters both clean → both excluded; halves still allowed:
    expect(has(12, 3)).toBe(false);
    expect(has(12, 4)).toBe(false);
    expect(has(24, 3)).toBe(false);
    expect(has(24, 4)).toBe(false);
    expect(has(12, 2)).toBe(true);
    expect(has(24, 2)).toBe(true);
  });

  it('safeGridPairs — real units (unit=100, cleanStep=50): quarters of G=2/10 become clean (0.5→50, 2.5→250)', () => {
    const pairs = safeGridPairs([2, 10], 100, 50);
    const has = (G: number, d: number) => pairs.some((p) => p.G === G && p.d === d);
    // With an axis in hundreds and a 50-visitor clean step, a quarter of a 2-step (0.5 = 50) is
    // clean, and the rival third (66.7) is not — so these quarter grids are now safe.
    expect(has(2, 4)).toBe(true);
    expect(has(10, 4)).toBe(true);
  });
  it('gridTicks + inferSubdivision', () => {
    expect(gridTicks(8, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(inferSubdivision(2, [0, 2, 4])).toBe(1);
    expect(inferSubdivision(2, [1, 2, 3])).toBe(2); // halves
    expect(inferSubdivision(2, [1.1])).toBeNull();  // finer than quarters
  });
  it('pickGrid returns a config whose yMax is a multiple of G', () => {
    const cfg = pickGrid({ candidateGs: [2, 4, 10, 20], unit: 100, cleanStep: 25, difficulty: 'hard', rng: () => 0 });
    expect(cfg.yMax % cfg.G).toBe(0);
    expect(cfg.d).toBeGreaterThanOrEqual(3); // hard → thirds/quarters
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `cd backend && npx vitest run src/services/chart-grid.test.ts`.

- [ ] **Step 3: Create `backend/src/services/chart-grid.ts`** (port of the maintainer reference, typos corrected):

```ts
// W-151: code chooses the chart grid so generated charts are always readable. Pure numeric core —
// no model calls, no DB. "Clean" is defined in REAL units (axisValue * unit), so an axis in hundreds
// makes 0.5 (= 50) clean. Thirds and quarters are the only subdivisions that can be visually
// confused, so a grid where BOTH read clean is unsafe.
export const TOL = 1e-6;
export const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
export const approxEq = (a: number, b: number) => Math.abs(a - b) < TOL;

export const isMultiple = (v: number, m: number) => Math.abs(v / m - Math.round(v / m)) < TOL;

/** Position of v inside its grid interval, in [0, 1). */
export const fracInInterval = (v: number, G: number) => {
  const q = v / G;
  return round6(q - Math.floor(q + TOL));
};

/** A value sits on a gridline or exactly halfway. */
export const isEasyPosition = (frac: number) => approxEq(frac, 0) || approxEq(frac, 0.5);

export type Subdivision = 1 | 2 | 3 | 4;
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GridConfig {
  G: number;         // gridline step, in axis units
  d: Subdivision;    // subdivision of one grid interval
  yMax: number;      // top of y-axis, multiple of G
  unit: number;      // real units per axis unit (e.g. 100 for "hundreds")
  cleanStep: number; // smallest "clean" amount in real units (e.g. 1 or 25)
}

/** Is an axis value clean once converted to real units? */
export const isClean = (axisValue: number, unit: number, cleanStep: number) =>
  isMultiple(axisValue * unit, cleanStep);

/** Thirds and quarters are the only subdivisions that can be confused. */
export const rivalOf = (d: Subdivision): 3 | 4 | null => (d === 3 ? 4 : d === 4 ? 3 : null);

export function safeGridPairs(candidateGs: number[], unit: number, cleanStep: number): { G: number; d: Subdivision }[] {
  const pairs: { G: number; d: Subdivision }[] = [];
  for (const G of candidateGs) {
    for (const d of [1, 2, 3, 4] as Subdivision[]) {
      if (!isClean(G / d, unit, cleanStep)) continue;
      const rival = rivalOf(d);
      if (rival && isClean(G / rival, unit, cleanStep)) continue;
      pairs.push({ G, d });
    }
  }
  return pairs;
}

export function pickGrid(opts: {
  candidateGs: number[]; unit: number; cleanStep: number; difficulty: Difficulty;
  intervals?: [number, number]; rng?: () => number;
}): GridConfig {
  const { candidateGs, unit, cleanStep, difficulty, intervals = [4, 6], rng = Math.random } = opts;
  const wanted = (d: Subdivision) => (difficulty === 'easy' ? d <= 2 : d >= 3);
  const pool = safeGridPairs(candidateGs, unit, cleanStep).filter((p) => wanted(p.d));
  if (!pool.length) throw new Error('No safe grid for these candidates/difficulty');
  const { G, d } = pool[Math.floor(rng() * pool.length)];
  const n = intervals[0] + Math.floor(rng() * (intervals[1] - intervals[0] + 1));
  return { G, d, yMax: G * n, unit, cleanStep };
}

/** Inclusive gridline ticks [0 … yMax]. */
export const gridTicks = (yMax: number, G: number): number[] =>
  Array.from({ length: Math.round(yMax / G) + 1 }, (_, i) => round6(i * G));

/** Coarsest subdivision (1–4) that places every value; null if none works. */
export function inferSubdivision(G: number, values: number[]): Subdivision | null {
  for (const d of [1, 2, 3, 4] as Subdivision[]) {
    if (values.every((v) => isMultiple(v, G / d))) return d;
  }
  return null;
}

/** Values readable as a third OR a quarter where the rival reading is also clean. */
export function ambiguousValues(values: number[], cfg: GridConfig): number[] {
  return values.filter((v) => {
    const frac = fracInInterval(v, cfg.G);
    if (isEasyPosition(frac)) return false;
    return ([3, 4] as const).some((k) => {
      const alt = Math.round(frac * k) / k;
      if (approxEq(alt, frac) || Math.abs(alt - frac) >= 0.1) return false;
      const altValue = v - frac * cfg.G + alt * cfg.G;
      return isClean(altValue, cfg.unit, cfg.cleanStep);
    });
  });
}
```

- [ ] **Step 4: Run it, expect PASS.** Adjust the test's expected `safeGridPairs` membership only if a hand-computed pair proves the test wrong (verify by hand: with unit=1, cleanStep=1, G/d must be integer; G=3→d∈{1,3} (G/2,G/4 non-integer); G=12→d∈{1,2,3,4} all integer but d=3 rival 4 also clean→excluded, d=4 rival 3 clean→excluded, so only {1,2}).

- [ ] **Step 5: Commit** (`feat(W-151): chart-grid numeric core — code owns the safe grid`).

---

### Task 3: `chart-question.ts` schema, validators, mapping (W-152)

**Files:**
- Modify: `backend/package.json` (add `zod`)
- Create: `backend/src/services/chart-question.ts`, `backend/src/services/chart-question.test.ts`

**Interfaces:**
- Consumes: everything from `chart-grid.ts` (Task 2); `GeneratedMathQuestion` from `ai.service.ts`.
- Produces: zod `ChartSpec`/`QuestionItem`/`Operation`; `computeAxis`, `criticalIndices`, `stepCount`, `misreadingAnswers`, `leakedNumbers`, `validateItem(raw, cfg, difficulty): { ok; errors; meta? }`, `toGeneratedMathQuestion(item, cfg, topicName): GeneratedMathQuestion`.

- [ ] **Step 1: Add zod** — `cd backend && npm install zod`. Confirm it appears under `dependencies` in `backend/package.json`.

- [ ] **Step 2: Write the failing test** — `backend/src/services/chart-question.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateItem, toGeneratedMathQuestion } from './chart-question';
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
    const r = validateItem(goodItem(), cfg, 'hard');
    expect(r.ok, JSON.stringify(r.errors)).toBe(true);
  });
  it('rejects a leaked chart number in the stem', () => {
    const item = goodItem();
    item.question_text = 'Visitors were 200, 400, 250, 600, 550. What is the range?';
    expect(validateItem(item, cfg, 'hard').ok).toBe(false);
  });
  it('rejects a wrong (code-recomputed) answer', () => {
    const item = goodItem(); item.answer = 500; item.options[0].value = 500;
    expect(validateItem(item, cfg, 'hard').ok).toBe(false);
  });
  it('rejects a value off the allowed 1/d fraction', () => {
    const item = goodItem(); item.chart.values = [2, 4, 1.65, 6, 5.5]; // 1.65 not a quarter of 2
    expect(validateItem(item, cfg, 'hard').ok).toBe(false);
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
```

- [ ] **Step 3: Run it, expect FAIL.**

- [ ] **Step 4: Create `backend/src/services/chart-question.ts`.** Port the maintainer reference's schema + validators (typos corrected), plus the two adaptations (`toGeneratedMathQuestion`, and `buildChartPrompt`/`generateChartQuestion` come in Task 4). Include:
  - `Operation` (zod discriminated union: `value`/`difference`/`range`/`sum`/`mean`), `computeAxis`, `criticalIndices`, `stepCount`.
  - `ChartSpec` (title/xLabel/yLabel/gridStep/yMax/labels/values) and `QuestionItem` (chart/question_text/operation/options[{value,error}]/answer/worked_solution) zod schemas.
  - `inferSubdivision`/`ambiguousValues`/`misreadingAnswers`/`leakedNumbers` (import numeric helpers from `./chart-grid`; `gridTicks(cfg.yMax, cfg.G)`).
  - `validateItem(raw, cfg, difficulty)`: zod parse → grid matches cfg → values in range / on 1/d / clean → no ambiguous → operation indices valid → **code-recomputed answer** (`round6(computeAxis(op, values) * cfg.unit)`) equals `item.answer` and the `error:null` option → options distinct, exactly one `error:null`, each wrong option names an error → no option in `misreadingAnswers` → no `leakedNumbers` → difficulty (easy: all easy positions; medium: ≥1 step≥2 and 1–2 off-gridline; hard: step≥2 and ≥1 answer-critical off-gridline).
  - `toGeneratedMathQuestion(item, cfg, topicName)`: build `options: string[]` from `item.options.map(o => String(o.value))`; `correctIndex` = index of the `error:null` option; `explanation` = `worked_solution` + `\n` + each wrong option as `If you chose {value}, you {error}.`; `stimulus` = `{ version: 1, text: '', figures: [{ kind: 'line-chart' | 'bar-chart', title, xLabel, yLabel, yMax: cfg.yMax, yTickStep: cfg.G, points: labels.map((x,i)=>({x, y: values[i]})) }] }`; `topicSlug: 'data-interpretation'`, `topicName`, `skillSlug: 'bar-and-line-graphs'`. (Chart kind: default `line-chart`; Task 4 threads the chosen kind through.)

  The complete function bodies for `computeAxis`, `criticalIndices`, `stepCount`, `misreadingAnswers`, `leakedNumbers`, and `validateItem` are the maintainer's reference implementation in `docs/superpowers/specs/2026-09-23-chart-question-pipeline-design.md`'s source (corrected: `computeAxis` typo-free; `numbersIn` strips thousands separators; leak forbidden set = gridline ticks + ticks*unit + values + values*unit, excluding 0). Reproduce them verbatim-adapted; do not invent alternative logic.

- [ ] **Step 5: Run it, expect PASS.** Fix real bugs surfaced by the tests (not by loosening assertions).

- [ ] **Step 6: Commit** (`feat(W-152): chart-question zod schema, validators, and GeneratedMathQuestion mapping`).

---

### Task 4: Generator + prompt + DI integration (W-153)

**Files:**
- Modify: `backend/src/services/chart-question.ts` (add `buildChartPrompt`, `generateChartQuestion`)
- Modify: `backend/src/services/ai.service.ts` (`generateMathWorksheetQuestions` DI routing)
- Test: `backend/src/services/chart-question.test.ts` (generator with a stub model)

**Interfaces:**
- Consumes: `chatCompletion`/`providerFor` from `ai.service.ts`; Task 2/3 exports.
- Produces: `buildChartPrompt(cfg, difficulty, kind): string`; `generateChartQuestion(cfg, difficulty, kind, callModel, maxAttempts?): Promise<GeneratedMathQuestion>`.

- [ ] **Step 1: Write the failing test** — append to `chart-question.test.ts`:

```ts
import { generateChartQuestion, buildChartPrompt } from './chart-question';

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
    const q = await generateChartQuestion(cfg, 'hard', 'line-chart', stub, 4);
    expect(call).toBe(2);
    expect(q.correctIndex).toBe(0);
    expect(q.stimulus).toMatchObject({ figures: [{ kind: 'line-chart', yMax: 8 }] });
  });
});
```

- [ ] **Step 2: Run it, expect FAIL.**

- [ ] **Step 3: Implement `buildChartPrompt` and `generateChartQuestion`** in `chart-question.ts`:
  - `buildChartPrompt(cfg, difficulty, kind)` — the maintainer reference prompt (corrected): state FIXED grid (`gridStep`, `yMax`, gridlines `gridTicks(cfg.yMax,cfg.G).join(', ')`, one axis unit = `cfg.unit` real units), the allowed fraction word for `cfg.d`, difficulty guidance, "refer to 'the chart'; do NOT write any data value, gridline value, or axis number", options rules (real units, one `error:null`, each wrong option names its mistake, no third/quarter-confusion distractor), operation enum, and a JSON-only response schema. Add "Do not change the grid." Include the chart `kind`.
  - `generateChartQuestion(cfg, difficulty, kind, callModel, maxAttempts = 4)` — loop: call model → `JSON.parse` (strip ``` fences) → `validateItem` → on ok, `return toGeneratedMathQuestion(parsed, cfg, 'Data Interpretation')` (thread `kind` into the figure); on failure append the errors to the prompt and retry; throw after `maxAttempts`.

- [ ] **Step 4: Run it, expect PASS.**

- [ ] **Step 5: Integrate into DI generation.** In `ai.service.ts` `generateMathWorksheetQuestions`, when `data-interpretation` is among the topics, produce a share of the needed questions via the new pipeline BEFORE/ALONGSIDE the batch loop:
  - Add module constant `const CHART_CANDIDATE_GS = [2, 3, 4, 5, 6, 9, 10, 12, 20];`, `const CHART_UNITS = [1, 10, 100];`.
  - Helper `async function generateDiChartQuestions(count: number): Promise<GeneratedMathQuestion[]>`: for each of `count`, pick a difficulty mix `const difficulty = Math.random() < 0.5 ? 'medium' : 'hard';` then `const unit = pick(CHART_UNITS); const cleanStep = unit === 1 ? 1 : 25; const cfg = pickGrid({ candidateGs: CHART_CANDIDATE_GS, unit, cleanStep, difficulty }); const kind = Math.random() < 0.5 ? 'line-chart' : 'bar-chart'; const q = await generateChartQuestion(cfg, difficulty, kind, (p) => chatCompletion(providerFor('generation'), p, generationTokenBudget(1), 0.8).then(r => r.content));` — collect, skipping failures. (The SAME `difficulty` must be passed to both `pickGrid` and `generateChartQuestion`.)
  - Route ~half of the DI questions this way (the rest stay on the existing batch path so pie/table still appear per W-146). These chart questions **bypass `verifyQuestionKey`** (code already recomputed the answer) but still go through the skill-tag audit and dedup. Keep the exact-count top-up behaviour.
  - Do NOT change generation for any non-DI topic.

- [ ] **Step 6: Run backend suite + typecheck** — `cd backend && npx vitest run && cd .. && npm run typecheck` → green.

- [ ] **Step 7: Commit** (`feat(W-153): chart-question generator + DI line/bar integration (code-recomputed answer replaces LLM audit)`).

---

### Task 5: e2e (W-154)

**Files:**
- Create: `e2e/chart-question-pipeline.spec.ts`

- [ ] **Step 1: Write the e2e spec.** Model on the existing `e2e/m3a-generation-tags.spec.ts` pattern: stub OpenAI on port 3106. Because chart questions call the model per-question with the chart prompt, the stub branches on the chart prompt (contains `gridStep =`) and returns a VALID `QuestionItem` JSON matching the grid the prompt states — parse `gridStep`/`yMax` out of the prompt text and echo values on those gridlines (e.g. all values = gridStep, so readability/answer hold for `operation: value`/`range`). For the skill-tag call return `{ skillSlug: 'bar-and-line-graphs' }`. Drive `generateMath(request, { topicIds: ['data-interpretation'], questionCount: 5 })`; assert questions come back, and at least one has a `stimulus` line/bar figure carrying `yTickStep`, and that no returned `questionText` contains a plotted value.

  (If deterministically satisfying `validateItem` from a stub proves fiddly, the stub may return an `operation:{type:'value',index:0}` item whose only value is a gridline — the simplest always-valid shape.)

- [ ] **Step 2: Run it, expect PASS** — `npx playwright test e2e/chart-question-pipeline.spec.ts`. Start the isolated stack if needed.

- [ ] **Step 3: Run the full e2e suite** — `npm run e2e` → all pass (existing DI specs use unbriefed/stubbed paths; confirm no regression).

- [ ] **Step 4: Commit** (`test(W-154): e2e — DI chart question renders explicit ticks and leaks no values`).

---

## Post-implementation (mandatory workflow step 5)

- [ ] Full suites green: `npm run e2e`, `cd backend && npx vitest run`, `cd frontend && npx vitest run`, `npm run typecheck`.
- [ ] Manual: `npm run dev`, generate a Data Interpretation worksheet; confirm a line/bar question (a) renders gridlines the values sit on or at clean half/quarter marks, (b) reads ≥1 value between gridlines, (c) is multi-step, (d) leaks no values in the stem, (e) the y-axis matches the described figure. Screenshot the chart.
- [ ] Hand over; tick W-150…W-154 only after user sign-off with commit hashes + proof.

## Self-Review

- **Spec coverage:** code-owns-grid (Task 2 `pickGrid`), model-within-constraints + no-leak + readable + code-answer + traps + difficulty (Task 3 `validateItem`), explicit render (Task 1), units (Tasks 2–3 `unit`/`cleanStep`), zod (Task 3), line+bar (Task 4 `kind`), mapping to app shape + skip LLM audit (Tasks 3–4), worksheets-only/lessons untouched (Global Constraints; only `ai.service.ts` DI path touched), e2e (Task 5). All covered.
- **Placeholder scan:** Task 3 Step 4 and Task 4 Step 3 reference the maintainer reference for the direct-port function bodies rather than duplicating ~200 lines; the reference is the authoritative source and every signature, adaptation, and all test code are given in full. Acceptable per DRY; the executor has the reference in the design doc/source.
- **Type consistency:** `GridConfig`, `Subdivision`, `Difficulty`, `validateItem(raw,cfg,difficulty)`, `toGeneratedMathQuestion(item,cfg,topicName)`, `generateChartQuestion(cfg,difficulty,kind,callModel,maxAttempts)`, `gridTicks(yMax,G)` used consistently across tasks. Figure fields `yMax`/`yTickStep` consistent between stimulus schema (Task 1) and mapping (Task 3).
