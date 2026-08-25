# Thinking Skills — Worksheet Generation (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Thinking Skills" subject (7 fixed sections, after Mathematics in the sidebar) whose
worksheet generation — via the Admin UI and coach chat — works exactly like Mathematics, at the
difficulty/format of `ThinkingSkills-Test7.pdf` / `Test8.pdf` (4-option A–D), including novel
`fold-cut` and `target` figures, with **zero Mathematics regression**.

**Architecture:** Generalize the existing MCQ stack to be subject-aware. `MathTopic` gains a
`subject` column (default `'math'`); Thinking Skills = topics with `subject: 'thinking-skills'`. The
same `MathQuestion`/`MathWorksheet`/`MathAttempt` tables and the single generation engine are reused
— the engine derives subject (and therefore option-count, exemplars, figure vocabulary) from the
resolved topics, so the Math path is unchanged.

**Tech Stack:** Express 4 + Prisma 5 + SQLite (backend); Vite + React 18 + TS + Tailwind (frontend);
OpenAI-compatible calls via `providerFor(role)`; Playwright + Vitest.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-25-thinking-skills-generation-design.md`.
- **Zero Mathematics regression.** `subject` defaults to `'math'`; every new parameter defaults to
  Math's current value; new routes/filters/UI are opt-in. For `subject: 'math'` the generation prompt
  string, validation, and option count must be **byte-for-byte identical to today**. The full
  `npm run e2e` + `npm test` suites must stay green; a changed Math spec is a regression to fix, not
  to edit.
- **4-option (A–D) for thinking-skills; 5-option (A–E) for math.** Honoured end to end (prompt,
  validation, UI).
- **Answer-key hygiene (§0/§10 of spec).** Students taking a Thinking Skills worksheet never receive
  `correctIndex`/`explanation` until they submit; the post-submit review shows them; admins always
  see them. Inherited from the reused tables/routes; explicitly re-tested.
- **One generation engine.** Do NOT fork the generator — parametrize it. Subject is derived from the
  resolved topics (all topics in one generation share a subject; mixed → error).
- **e2e stack:** fresh `e2e.db`, ports 3105/5273, OpenAI stub on 3106. Generation stubs branch on the
  request body (`independently solving` = verifier, `skill tag` = tag audit, else generation).
- **Mandatory 5-step workflow** (`CLAUDE.md`) per work item: plan → approval → worklog → RED-first →
  full suites green → user sign-off before ticking.

**Section slugs (fixed):** `finding-procedures`, `evaluating-reasoning-errors`, `logical-analysis`,
`visual-reasoning`, `evaluating-evidence`, `identifying-similarity`, `relevant-selection`.

---

### Task 1: `MathTopic.subject` column (additive migration)

**Files:**
- Modify: `backend/prisma/schema.prisma` (`MathTopic`)
- Create: `backend/prisma/migrations/<ts>_add_topic_subject/migration.sql` (via `prisma migrate dev`)
- Test: `backend/src/__tests__/topic-subject.test.ts`

**Interfaces:**
- Produces: `MathTopic.subject String @default("math")`.

- [ ] **Step 1: Write the failing test** — a Vitest test that reads the Prisma schema/client and
  asserts `MathTopic` has a `subject` field defaulting to `'math'`:
```typescript
// topic-subject.test.ts — assert the column exists with the math default
import prisma from '../lib/prisma';
it('MathTopic.subject exists and a created topic defaults to math', async () => {
  const t = await prisma.mathTopic.create({ data: { name: 'TS Probe', slug: `probe-${Date.now()}`, description: 'x' } });
  expect(t.subject).toBe('math');
  await prisma.mathTopic.delete({ where: { id: t.id } });
});
```
- [ ] **Step 2: Run → FAIL** (`npm test -w backend -- topic-subject`) — `subject` unknown.
- [ ] **Step 3: Implement** — add `subject String @default("math")` to `MathTopic`; run
  `cd backend && npx prisma migrate dev --name add_topic_subject && npx prisma generate`.
- [ ] **Step 4: Run → PASS**; `npm test -w backend` stays green (existing topics default to `'math'`).
- [ ] **Step 5: Commit** — `feat(thinking-skills): MathTopic.subject column (default math)`

---

### Task 2: Subject-aware topics list route

**Files:**
- Modify: `backend/src/routes/math-topics.ts`
- Test: `e2e/ts-topics.spec.ts`

**Interfaces:**
- Produces: `GET /api/math/topics?subject=<math|thinking-skills>` — **defaults to `'math'`** (today's
  behaviour preserved). Returns topics filtered by subject, `orderBy name`.

- [ ] **Step 1: Write the failing e2e** — `GET /api/math/topics` returns only math topics (count
  unchanged, none with `subject !== 'math'`); `?subject=thinking-skills` returns the 7 sections (after
  Task 3 seeds them — for now assert the default excludes any thinking-skills topic and the param is
  honoured against a seeded probe).
- [ ] **Step 2: Run → FAIL** (route ignores subject).
- [ ] **Step 3: Implement** — `const subject = (req.query.subject as string) || 'math';
  where: { subject }`. The `:slug` detail route is unchanged (slug is globally unique).
- [ ] **Step 4: Run → PASS**; full topic-consuming specs stay green.
- [ ] **Step 5: Commit** — `feat(thinking-skills): subject filter on GET /math/topics (default math)`

---

### Task 3: Seed — 7 sections, 7 skills, exemplar questions

**Files:**
- Modify: `backend/prisma/seed-skills.ts` (add `THINKING_SKILLS` taxonomy)
- Create: `backend/prisma/seed-thinking-skills.ts` (sections + exemplar questions + `seedThinkingSkills(prisma)`)
- Modify: `backend/prisma/seed.ts` (call `seedThinkingSkills` after `seedMath`)
- Test: `e2e/ts-seed.spec.ts`

**Interfaces:**
- `THINKING_SKILLS: Record<string, SkillSeed[]>` — one `SkillSeed` per section (slug = section slug),
  `examLevelNotes` describing NSW Thinking-Skills mastery (tutor voice).
- `seedThinkingSkills(prisma)` — upserts the 7 topics (`subject: 'thinking-skills'`), the 7 skills
  (`subject: 'thinking-skills'`, `topicId` set), and 2–4 **exemplar** bank questions per section
  (`worksheetId: null`, 4 options, real explanation, `stimulus` where the PDF had a figure). Idempotent
  (upsert by slug / find-by-text), mirroring `seedMath`.

**Content note (judgment — transcribe from the PDFs):** exemplars are hand-picked from
`ThinkingSkills-Test7.pdf` / `Test8.pdf`, one representative question per section minimum, preserving
the 4-option format, the stem, the correct answer, and the "Question Feedback" explanation verbatim;
attach a `stimulus` for the ones with a table/chart/shape/fold-cut/target. These anchor difficulty.

- [ ] **Step 1: Write the failing e2e** — after seeding, `GET /api/math/topics?subject=thinking-skills`
  returns exactly the 7 sections (by slug); each has ≥1 bank question; `GET /api/skills` includes 7
  skills with `subject: 'thinking-skills'`.
- [ ] **Step 2: Run → FAIL** (no thinking-skills data).
- [ ] **Step 3: Implement** the taxonomy + seed function + wire into `seed.ts`. Author `THINKING_SKILLS`
  and exemplars (judgment work — not delegated to a weaker model).
- [ ] **Step 4: Run → PASS**; `npm test -w backend` + seed re-run idempotent.
- [ ] **Step 5: Commit** — `feat(thinking-skills): seed 7 sections + skills + PDF exemplars`

---

### Task 4: Novel figure kinds — `fold-cut` and `target`

**Files:**
- Modify: `backend/src/lib/stimulus.ts` (Figure union + interfaces + validation)
- Modify: `frontend/src/lib/stimulus.ts` (mirror the types)
- Modify: `frontend/src/components/StimulusFigure.tsx` (render cases)
- Test: `backend/src/__tests__/stimulus.test.ts` (validation), `e2e/ts-figures.spec.ts` (render)

**Interfaces:**
- `FoldCutFigure { kind: 'fold-cut'; folds: ('h'|'v')[]; cut: { quadrant: [0|1,0|1]; shape: 'triangle'|'diamond'|'circle' }[] }`
  — enough to render the unfolded 2×2 (or 2×1) quadrant result and to re-solve.
- `TargetFigure { kind: 'target'; rings: number[]; darts: { ring: number; angleDeg: number }[] }` — ring
  scores outermost→innermost and dart positions, so a total-score question is answerable from the figure.
- Both added to the `Figure` union and to `isValidStimulus` (backend) and the frontend union.

- [ ] **Step 1: Write the failing tests** — (a) backend: `isValidStimulus` accepts a well-formed
  `fold-cut` and `target` and rejects malformed ones; (b) e2e: a saved question carrying a `fold-cut`
  figure and one carrying a `target` figure both render on the review page (assert testids
  `stimulus-fold-cut` / `stimulus-target`).
- [ ] **Step 2: Run → FAIL** (kinds unknown).
- [ ] **Step 3: Implement** the interfaces + validation in both `stimulus.ts` files and the two render
  components in `StimulusFigure.tsx` (SVG; give each a `data-testid`).
- [ ] **Step 4: Run → PASS**; `npm run typecheck` clean; existing stimulus tests green.
- [ ] **Step 5: Commit** — `feat(thinking-skills): fold-cut + target stimulus figures`

---

### Task 5: Subject-parametrized generation engine

**Files:**
- Modify: `backend/src/services/ai.service.ts`
- Test: `backend/src/services/ts-generation.test.ts`

**Interfaces:**
- `generateQuestionBatch(topics, count, avoidTexts, opts?: { optionCount: number; subject: string })`
  — the prompt asks for `${optionCount}`-option questions and `${optionCount-1}` distractors; the
  figure-vocabulary block gets `fold-cut`/`target` appended **only** when `subject === 'thinking-skills'`.
  For `subject: 'math'`, the produced prompt string is **identical to today**.
- `isValidGeneratedQuestion(q, allowedSlugs, optionCount = 5)` — accepts exactly `optionCount` options.
- `generateMathWorksheetQuestions(topics, questionCount, avoidTexts, opts?)` — threads `opts` to the
  batch + validation.
- `generateMathWorksheet(topicSlugs, questionCount, workspaceId)` — resolves topics, **derives the
  subject** from them (all must share one subject; mixed → throw `'Cannot mix subjects in one
  worksheet'`), computes `optionCount` (`thinking-skills` → 4, else 5), and calls the core. Signature
  unchanged; Math behaviour unchanged. The W-88 grid-compass filter stays guarded to `subject: 'math'`.

- [ ] **Step 1: Write the failing unit tests** (AI stubbed via `chatCompletion` mock):
  - a math generation run asks for `5`-option questions and validates 5 (regression guard: the prompt
    contains `five-option`/`5` exactly as today);
  - a thinking-skills run (topics resolve to subject `'thinking-skills'`) asks for `4`-option questions,
    validates 4, and the prompt's figure vocabulary includes `fold-cut` and `target`;
  - a thinking-skills batch passes the section exemplars in as difficulty anchors;
  - mixing a math + a thinking-skills topic throws.
- [ ] **Step 2: Run → FAIL** (option count hardcoded to 5; no subject derivation).
- [ ] **Step 3: Implement** — parametrize `five-option`→`${optionCount}-option` and `four ...
  distractors`→`${optionCount - 1}`; `options.length === ${optionCount}`; conditional figure block;
  subject derivation + optionCount in `generateMathWorksheet`. Keep the math branch producing today's
  exact strings (assert via the regression guard test).
- [ ] **Step 4: Run → PASS**; `npm test -w backend` green.
- [ ] **Step 5: Commit** — `feat(thinking-skills): subject-aware generation (4-option, exemplars, figures)`

---

### Task 6: Coach chat — extend `generate_worksheet` to thinking-skills

**Files:**
- Modify: `backend/src/services/chat-tools.ts` (schema enum + executor)
- Modify: `backend/src/services/chat.service.ts` (system prompt mentions the subject)
- Test: `backend/src/services/chat-tools.generate.test.ts` (extend), `e2e/ts-chat-generate.spec.ts`

**Interfaces:**
- `generate_worksheet` `subject` enum → `['math', 'thinking-skills']` (writing generation is not a chat
  path today). Executor: resolve `skillSlugs` → topics filtered by the tool's `subject`; resolve
  `topicSlugs` as thinking-skills/math topics per subject; call `generateMathWorksheet` (subject derived
  from the resolved topics) and **save unassigned** (W-85), returning the compact
  `{ saved, worksheetId, title, questionCount, subject }`.

- [ ] **Step 1: Write the failing tests** — unit: `generate_worksheet` with `subject:'thinking-skills'`
  + `skillSlugs:['logical-analysis']` resolves to the logical-analysis topic and calls the shared
  generator with those topics; e2e (chat stub): the tool saves a thinking-skills worksheet unassigned
  and returns the compact result; questions never enter the transcript.
- [ ] **Step 2: Run → FAIL** (enum/executor math-only).
- [ ] **Step 3: Implement** the enum, subject-aware skill/topic resolution, and prompt mention.
- [ ] **Step 4: Run → PASS**; full backend + chat specs green.
- [ ] **Step 5: Commit** — `feat(thinking-skills): coach chat generate_worksheet for thinking-skills`

---

### Task 7: Admin UI — Thinking Skills generate flow

**Files:**
- Modify: `frontend/src/pages/Admin.tsx` (a Thinking Skills generate card mirroring the math one)
- Modify: `frontend/src/lib/api.ts` if a subject-scoped topics fetch helper is needed
- Test: `e2e/ts-admin-generate.spec.ts`

**Interfaces:**
- A Thinking Skills generate card: loads the 7 sections (`getTopics({ subject: 'thinking-skills' })`),
  multi-select + question count → **Generate** (reuses `mathApi.startGeneration(topicSlugs, count)`,
  which now derives subject from the topics) → review (admin sees full questions incl. correct answer +
  explanation, and any `fold-cut`/`target` figure) → **Save** (unassigned) → **Assign**. Reuses the
  existing review/save/assign components and the saved-worksheet list.

- [ ] **Step 1: Write the failing e2e** (admin storageState, generation stub returns 4-option TS
  questions incl. a `target` figure): open `/admin`, Thinking Skills tab/card, select a section, set
  count, Generate → review shows the questions + the figure → Save → the saved worksheet appears with
  View/Assign/Delete → Assign to the e2e student → student sees it.
- [ ] **Step 2: Run → FAIL** (no TS generate UI).
- [ ] **Step 3: Implement** the card (mirror `handleGenerateMath` / the math review + save + assign).
- [ ] **Step 4: Run → PASS**; `npm run typecheck` clean; live screenshot of the generate + review.
- [ ] **Step 5: Commit** — `feat(thinking-skills): Admin UI generate flow`

---

### Task 8: Sidebar — Thinking Skills section

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Modify: `frontend/src/App.tsx` only if a new route is needed (the existing `/math/:topicSlug` page is
  subject-agnostic and serves thinking-skills topics)
- Test: `e2e/ts-sidebar.spec.ts`

**Interfaces:**
- A "Thinking Skills" nav section immediately after Mathematics, styled like the Mathematics section,
  listing the 7 subsections; each links to the existing topic page (`/math/<section-slug>`), where the
  student sees/starts assigned Thinking Skills worksheets. (Score tiles/heatmap are Phase 2 — omitted
  here.)

- [ ] **Step 1: Write the failing e2e** — the sidebar shows "Thinking Skills" after "Mathematics" with
  the 7 subsection labels; clicking one opens its topic page.
- [ ] **Step 2: Run → FAIL** (no section).
- [ ] **Step 3: Implement** — fetch `getTopics({ subject: 'thinking-skills' })`; render the section
  mirroring the Mathematics block (minus the per-topic score tiles for Phase 1).
- [ ] **Step 4: Run → PASS**; `npm run typecheck` clean; live screenshot.
- [ ] **Step 5: Commit** — `feat(thinking-skills): sidebar section with the 7 subsections`

---

### Task 9: Answer-key hygiene + full-suite regression + handover

**Files:**
- Create: `e2e/ts-answer-key-hygiene.spec.ts`

**Interfaces:** proves §10 of the spec for thinking-skills, reusing the existing strip machinery.

- [ ] **Step 1: Write the e2e** — seed/generate + save + assign a thinking-skills worksheet:
  - student `GET /api/math/worksheets` / the in-test question payload carries options but **no**
    `correctIndex` and **no** `explanation`;
  - the same worksheet fetched as admin **includes** `correctIndex` + `explanation`;
  - after the student submits an attempt, the review page shows the correct answer + explanation.
- [ ] **Step 2: Run → GREEN** (behaviour inherited; if RED, fix the reuse, not by weakening the strip).
- [ ] **Step 3: Full gate** — `npm run e2e` + `npm test` + `npm run typecheck` all green. The unchanged
  Mathematics specs passing is the **no-regression proof**.
- [ ] **Step 4: Commit** — `test(thinking-skills): answer-key hygiene + full-suite regression`
- [ ] **HANDOVER for sign-off** — dev servers up; state what changed, what to check (generate a TS
  worksheet from the Admin UI and from coach chat; confirm 4-option, figures render, students can't see
  answers pre-submit, Math unchanged), and the proving specs. Await explicit user approval before
  ticking any worklog item.

---

## Self-review (author checklist — completed)

- **Spec coverage:** §3 data → Task 1/2; §4 seed/exemplars → Task 3; §6 figures → Task 4; §5 engine →
  Task 5; §8 chat → Task 6; §7 Admin UI → Task 7; §9 sidebar → Task 8; §10 hygiene + §0 no-regression →
  Task 9. All covered.
- **No-regression guardrails:** `subject` defaults to `'math'`; the Task-5 regression-guard test pins
  the math prompt/option-count to today; every task ends with the full suite green.
- **Type consistency:** `generateMathWorksheet(topicSlugs, count, workspaceId)` keeps its signature;
  `opts { optionCount, subject }` threads consistently through Tasks 5/6; figure kinds `fold-cut`/
  `target` are identical in both `stimulus.ts` files (Task 4).
- **Placeholder scan:** the only intentionally-unwritten literals are the **exemplar seed content**
  (Task 3) and the **generation prompt wording** (Task 5) — both judgment work transcribed from the
  PDFs / authored by a capable model, with their structure and tests fully specified.
