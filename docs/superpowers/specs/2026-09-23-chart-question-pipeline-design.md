# Code-Owned Grid for Chart-Reading Questions — Design

Date: 2026-09-23
Status: Approved for planning

## Problem

Generated Data Interpretation line/bar-chart questions had three defects (observed on a real
worksheet, Q3):

1. **Value leak** — the question stem and the "Shared Information" lead-in listed every data point,
   so the chart was decoration.
2. **Text contradicts the chart** — the stem described gridlines (0, 1.1, 2.2, 3.3, 4.4) that did
   not match the rendered axis (0, 2, 4, 6, 8). Root cause: `<YAxis>` has no `domain`/`ticks`, so
   **Recharts auto-scales**; the model has no control over — and cannot predict — the gridlines, so
   it invents them in prose.
3. **Unreadable values** — with a rendered grid step of 2, values like 1.65 / 2.2 / 2.75 fall
   between readable positions, so a student can only guess them.

Prompt-only fixes cannot *guarantee* readability because the model does not control the axis. The
maintainer's requirement — "at least one value read between gridlines at a clean half/quarter step" —
can only be guaranteed if code owns the grid.

## Approach (maintainer-provided, adapted to this codebase)

**Code owns the grid; the model writes within fixed constraints; code validates everything.**

1. **Code picks a SAFE grid.** `safeGridPairs(candidateGs, unit, cleanStep)` enumerates
   `(G, subdivision d)` pairs where every allowed position is a clean real-world amount AND no rival
   subdivision (thirds vs quarters) also lands clean (which would make a point ambiguous).
   `pickGrid(...)` chooses one for the target difficulty and sets `yMax = G * n`.
2. **The model writes** values, question text, an operation type, and options — all within the fixed
   `(G, d, yMax, unit)` the code chose. The prompt states the grid as an immovable constraint.
3. **Code validates**: values on a gridline or the allowed 1/d fraction; clean in real units; no
   third-vs-quarter ambiguity; **no chart numbers leaked into the stem**; **answer recomputed by
   code** (not by an LLM); no distractor reachable purely by a third/quarter misreading; difficulty
   (step count, how many read values sit off-gridline).
4. **Strict render**: the `<YAxis>` is given an explicit `domain=[0,yMax]` and `ticks`, and no data
   labels/tooltips — the student must read the chart.

### Decisions (confirmed with maintainer)

- **Validation library:** add **zod** as a backend dependency for the chart-question schema/parsing.
  The numeric checks are pure functions either way; zod only handles the schema layer.
- **Chart scope:** **line + bar** route through the new pipeline now. Pie and table keep the current
  generation path.
- **Units:** adopt the **real-units vs axis-units** concept (`unit` multiplier + `cleanStep`), e.g.
  axis in hundreds → value 2.2 = 220 visitors, enabling unit conversion as the "extra step".

## Integration with the existing architecture

The reference module is standalone (own zod schema, own React renderer, own generation loop). It is
**adapted**, not bolted on:

- **Output mapping.** The new pipeline emits the app's existing `GeneratedMathQuestion`:
  `options[{value,error}]` → `options: string[]` (formatted real-unit values) + `correctIndex` (the
  `error:null` option) + `explanation` (worked_solution followed by per-distractor "If you chose X …"
  error names); `chart` → `stimulus` (a `line-chart`/`bar-chart` figure carrying the new `yMax` /
  `yTickStep`). So save, heatmap, review and practice UI are unchanged.
- **Renderer.** Extend the existing `StimulusFigure` line/bar renderer with explicit
  `domain`+`ticks` when `yMax`/`yTickStep` are present (auto-scale fallback otherwise). Do NOT add a
  parallel `SpecLineChart`/`QuestionCard`.
- **Answer audit.** For these code-validated chart questions, **code recomputation replaces the LLM
  answer-key audit** (`verifyQuestionKey`) — code owning the answer is stronger than an LLM re-solve.
  Skill-tag audit still applies.
- **Sub-pipeline.** Only `data-interpretation` line/bar-chart questions go through the new path,
  invoked from `generateMathWorksheetQuestions`. Other topics and pie/table are untouched.

## Module layout

- `frontend/src/lib/stimulus.ts` — add optional `yMax` / `yTickStep` to `LineChartFigure` /
  `BarChartFigure`; `validateStimulus` accepts them (positive; `yMax` a multiple of `yTickStep`).
- `frontend/src/components/StimulusFigure.tsx` — explicit `domain`+`ticks` for line/bar when set.
- `backend/src/services/chart-grid.ts` — pure numeric core: `isMultiple`, `fracInInterval`,
  `isClean`, `rivalOf`, `safeGridPairs`, `pickGrid`, `gridTicks`, `inferSubdivision`,
  `ambiguousValues`.
- `backend/src/services/chart-question.ts` — zod `ChartSpec`/`QuestionItem`/`Operation`;
  `computeAxis`, `criticalIndices`, `stepCount`, `misreadingAnswers`, `leakedNumbers`,
  `validateItem`, `buildChartPrompt`, `generateChartQuestion` (retry-on-validation loop calling the
  generation model), and `toGeneratedMathQuestion` (maps to the app shape).
- `backend/src/services/ai.service.ts` — route a portion of DI line/bar questions through the new
  pipeline; skip the LLM answer audit for them.

## Testing

- **Unit — `chart-grid`:** `safeGridPairs` excludes third/quarter conflicts (e.g. G=12/24 exclude
  thirds+quarters, keep halves); with whole-number units yields G∈{3,9} thirds and G∈{2,4,10,20}
  quarters; `gridTicks`/`fracInInterval`/`isClean` correct on worked cases.
- **Unit — `chart-question`:** `validateItem` rejects leaked numbers, off-fraction values,
  third/quarter-ambiguous values, wrong code-recomputed answers, and misreading-trap distractors;
  accepts a correct item. `toGeneratedMathQuestion` maps options/correctIndex/explanation/stimulus
  faithfully.
- **Unit — render:** `gridTicks` drives the YAxis ticks; a figure with `yMax`/`yTickStep` validates.
- **e2e:** admin generates a DI worksheet (stubbed model returns a valid chart item); the saved
  question renders a chart with explicit ticks and leaks no values.

## Out of scope

- Lesson generation (`coaching.service.ts`) prompts and figures.
- Pie and table question generation (unchanged).
- Replacing the batch generator for non-chart questions.
