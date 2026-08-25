# Thinking Skills — Worksheet Generation (Phase 1) — design

**Status:** Approved design (brainstormed and approved section-by-section with the user, 2026-08-25).
**Feature:** Add a "Thinking Skills" subject to the app, at **full parity with Mathematics**
(generation + heatmap + opportunity areas), delivered in phases. **This spec covers Phase 1 —
worksheet generation** (data foundation + subject-aware generation engine + Admin UI + coach chat +
novel visual figures), designed so the later parity phases drop in without rework.
**Depends on:** the existing Mathematics stack (topics, questions, worksheets, attempts, stimulus
figures, generation service, answer-key verifier, skill-tagging, de-dup) — all complete and shipping.

---

## 0. Non-negotiables (from the user)

- **Zero Mathematics regression.** No change may alter Mathematics UX or generation behaviour. The
  approach is additive and subject-guarded: a new `subject` column **defaults to `'math'`**, so every
  existing row and every existing query keeps its current behaviour. The full `npm run e2e` +
  `npm test` suites (the 150-test regression net) must stay green; any Math spec that changes is a
  regression to investigate, not to "update".
- **Rigorous generation testing, mirroring Mathematics.** Every generation path is covered RED-first:
  unit tests for the generation core (option count, exemplar anchoring, de-dup, skill-tagging control
  flow) with the AI stubbed, plus e2e for the Admin UI generate flow and the coach-chat
  `generate_worksheet` path with the OpenAI stub — the same rigor and structure Mathematics generation
  has today (`worksheet-enhancements`, `w8-visual-stimuli`, `w85..w88`).
- **Answer-key hygiene (inherits Math §0.6).** A student taking a generated Thinking Skills worksheet
  **must not see the correct answer or the explanation until they submit**. The post-submit review
  shows the correct answer + explanation. **Admins always see** the correct answer + explanation
  (review-in-editor before assigning, and any admin view). This is Mathematics' existing behaviour
  (`stripWorksheetAnswersForStudents` + the student-facing question strip, W-28/W-29/W-30); Thinking
  Skills inherits it by reusing the same tables/routes, and it is **explicitly re-tested** for
  thinking-skills.
- **Mandatory workflow (`CLAUDE.md`)** applies to every work item: plan → approval → worklog items →
  implement RED-first → full suites green → user manual sign-off before ticking.

## 1. Scope

**In scope (Phase 1):**
- A "Thinking Skills" subject with exactly 7 fixed sections (below), shown in the sidebar after
  Mathematics.
- Seed data: the 7 sections, a skill per section, and exemplar questions per section (difficulty
  anchors) extracted from `ThinkingSkills-Test7.pdf` / `Test8.pdf`.
- Worksheet **generation** at parity with Mathematics, from **both** the Admin UI and **coach chat**:
  batched AI generation → answer-key verifier → skill-tagging → strict de-duplication → save
  unassigned → review → assign.
- **4-option (A–D)** multiple-choice questions (Mathematics is 5-option A–E) — the format shown in the
  PDFs.
- **Novel visual figures** built in this first cut: `fold-cut` (paper folding) and `target`
  (dartboard), plus reuse of existing figure kinds.
- Answer-key hygiene enforced and tested (§0).

**Out of scope (later phases, enabled by this data model, NOT built here):**
- Phase 2: per-section timed-practice bank + sidebar score tiles + heatmap page for Thinking Skills.
- Phase 3: opportunity areas / per-skill analytics for Thinking Skills.
- Phase 4: coaching lessons for Thinking Skills.

## 2. The 7 sections (exact, fixed)

Section name → slug:
- Finding Procedures → `finding-procedures`
- Evaluating Reasoning Errors → `evaluating-reasoning-errors`
- Logical Analysis → `logical-analysis`
- Visual Reasoning → `visual-reasoning`
- Evaluating Evidence → `evaluating-evidence`
- Identifying Similarity → `identifying-similarity`
- Relevant Selection → `relevant-selection`

## 3. Data model

**One migration, additive:**
- `MathTopic` gains `subject String @default("math")`. Existing 20 topics become `'math'`; the 7
  Thinking Skills sections are seeded as topics with `subject: 'thinking-skills'`.
- **No other schema changes.** `MathQuestion`, `MathWorksheet`, `MathAttempt`,
  `MathWorksheetAssignment`, `MathStimulusGroup` are reused unchanged — they are keyed off
  `MathTopic`, so they become subject-aware by association. `Skill` already has a `subject` column.

Because the tables are the generic MCQ stack (documented, not renamed), a "Thinking Skills question"
is a `MathQuestion` whose topic has `subject: 'thinking-skills'`, and a Thinking Skills worksheet is a
`MathWorksheet` over those topics — the entire worksheet/attempt/assignment/review machinery works
without change.

**Subject-awareness in queries (additive, no behaviour change for math):**
- `GET /api/math/topics` gains an optional `?subject=` filter (**default `'math'`** to preserve today's
  behaviour). A new `GET /api/math/topics?subject=thinking-skills` returns the 7 sections. The sidebar
  and Admin Thinking Skills flow use the filtered call; every existing caller is untouched.
- Every place that currently lists "all math topics" for generation/heatmap continues to mean
  `subject: 'math'` unless a subject is passed.

## 4. Seed: skills + exemplars (difficulty anchors)

- **7 skills** (`subject: 'thinking-skills'`), one per section, `slug` = section slug, with an
  `examLevelNotes` describing NSW-Selective Thinking-Skills mastery for that section — used as the
  closed skill list for skill-tagging and (later) opportunity areas.
- **Exemplar questions per section** (2–4 each), hand-transcribed from Test7/Test8 into the seed with:
  4 options, `correctIndex`, the real "Question Feedback" explanation, the owning topic, the skill,
  and a `stimulus` where the original had a figure (table/chart/shape/fold-cut/target). These exemplars
  are stored as bank questions (`worksheetId: null`) for their section and are the **difficulty and
  style anchors** the generator is shown ("produce questions at or above the difficulty of these"),
  exactly as Mathematics anchors on each topic's hardest reference question. (No cohort `percentCorrect`
  is available from the PDFs; anchoring is by exemplar text/figure, not by %.)

## 5. Generation engine — subject-parametrized (the "exactly like Math" core)

Generalize the existing generation so Math and Thinking Skills share **one** engine (single source of
truth — preserves the W-85/86/87/88 behaviour and avoids drift):

- Extract the current `generateMathWorksheet(topicSlugs, questionCount, workspaceId)` /
  `generateMathWorksheetQuestions(...)` into a subject-aware core that takes:
  - the **subject** (`'math'` | `'thinking-skills'`),
  - the resolved **topics** (section rows) with their **skills** and **exemplar anchors**,
  - the **option count** (`5` for math, `4` for thinking-skills),
  - the **figure vocabulary** available for the subject.
- **Everything else is identical to Math:** batched generation (`GENERATION_BATCH_SIZE`), the
  answer-key verifier (reasoning model re-solves each candidate), the skill-tag verifier, the strict
  de-duplication avoid-list (W-87, incl. previous-worksheet questions per workspace), top-up batches,
  and the offline fallback.
- **Option count is honoured end to end:** the generation prompt asks for N options, validation
  (`isValidGeneratedQuestion` / distinct-options check) accepts N options, and the UI/render use N.
  Math stays 5; Thinking Skills is 4.
- The Math-only `grid-compass` correctness check (W-88) is guarded to `subject: 'math'` topics and does
  not run for thinking-skills (it is math-grid-specific).
- Backwards compatibility: `generateMathWorksheet(...)` keeps its exact Math signature/behaviour (it
  becomes a thin call into the shared core with math config), so the Math Admin route and Math chat
  path are byte-for-byte unchanged.

## 6. Novel visual figures (first cut)

Add two figure kinds to the stimulus system — the TS `Figure` union, the renderer
(`frontend/src/components/StimulusFigure.tsx`), the generation prompt's figure vocabulary, and the
verifier prompt (so it re-solves from the same figure data the student sees):
- **`fold-cut`** — a rectangle folded in half one or more times with a cut, rendered as the unfolded
  result showing the cut-outs in each quadrant (Test8 Q10). Data carries fold axes + cut position(s)
  sufficient to render and to re-solve.
- **`target`** — concentric-ring dartboard with labelled ring scores and dart positions, so a "total
  score" question is fully answerable from the figure (Test8 Q11).
- **Reused kinds** cover the rest: `table` (admission fees, code-substitution, eligibility grids),
  `line-chart` (Daxton percentage graph), `grid` / `shape` (square-composition, spatial). No new kinds
  needed for those.
- The existing HARD RULE stands: a question referencing a visual is discarded unless it carries a
  stimulus with all data needed to solve it.

## 7. Admin UI (generation path 1)

Mirror the Mathematics generate flow for Thinking Skills, reusing the existing review/save/assign
components:
- A Thinking Skills generation card: multi-select the 7 sections + choose question count → **Generate**
  (background job, like math) → **review** the generated questions (admin sees full text, options,
  correct answer, and explanation) → **Save** (unassigned, per W-85) → **Assign** to students (per
  W-85 assign control).
- Reuses `MathWorksheetContent` / the review UI and the saved-worksheet list (View · Assign · Delete),
  which already work for any `MathWorksheet`.

## 8. Coach chat (generation path 2)

- Extend the `generate_worksheet` tool's `subject` enum to include `'thinking-skills'`; the executor
  calls the shared generation core with thinking-skills config and **saves the worksheet unassigned**
  (W-85), returning the compact `{ worksheetId, title, questionCount }` and pointing the admin to the
  Admin page to review/assign. System prompt updated to mention the Thinking Skills subject.
- Same confirmation-gating, same compact-result cap, same "call the tool directly, no format
  questions" guidance as Math (W-85/W-86).

## 9. Sidebar

Add a **"Thinking Skills"** section immediately after Mathematics, styled the same as the Mathematics
section, listing the 7 subsections. Each subsection links to the existing topic page (made
subject-aware) where a student sees and starts assigned Thinking Skills worksheets. Per-section score
tiles / heatmap arrive in Phase 2; Phase 1 shows the section list and the assigned-worksheet entry
point.

## 10. Answer-key hygiene (explicit, tested)

- **Student, pre-submit:** the questions delivered to a student taking a Thinking Skills worksheet
  carry **no `correctIndex` and no `explanation`** (the existing `stripWorksheetAnswersForStudents` and
  student question-strip apply because these are `MathWorksheet`/`MathQuestion` rows).
- **Student, post-submit:** the attempt-review page shows the correct answer + explanation for the
  submitted attempt (existing `MathAttemptReview`).
- **Admin, always:** full question incl. correct answer + explanation (generation review, saved-list
  View, and any admin question fetch).
- **Tests:** a dedicated e2e asserts a student fetching an assigned Thinking Skills worksheet receives
  options but no `correctIndex`/`explanation`, and that the same worksheet fetched as admin includes
  them; plus a post-submit review shows the explanation.

## 11. Testing strategy (RED-first, mirroring Mathematics)

Isolated e2e stack only (fresh `e2e.db`, ports 3105/5273, OpenAI stub on 3106). New specs, each RED
first then GREEN, then the full suite:
- **Unit (backend, AI stubbed):** the shared generation core honours a 4-option config (prompt asks
  for 4, validation accepts 4); exemplar anchoring passes the section exemplars into the prompt; the
  de-dup avoid-list includes prior thinking-skills questions; skill-tagging restricts to the section's
  skills. (Mirror `chat-tools.generate.test.ts`, `generation-uniqueness.test.ts`.)
- **e2e — Admin UI generate:** generate a Thinking Skills worksheet (stubbed model returns 4-option
  questions incl. a `fold-cut`/`target` stimulus) → review shows the questions and the figure →
  save unassigned → assign to a student → the student sees it. (Mirror `worksheet-enhancements`,
  `w8-visual-stimuli`, `w85`.)
- **e2e — coach chat generate:** `generate_worksheet` with `subject: 'thinking-skills'` saves a
  worksheet unassigned and returns the compact result; the questions never enter the transcript.
  (Mirror `w85-assign-saved-worksheet` + `chat-tools.generate.test`.)
- **e2e — answer-key hygiene:** §10 above.
- **e2e — novel figures render:** a saved `fold-cut` and `target` figure render on the review/practice
  page. (Mirror `w8-visual-stimuli`.)
- **Regression net:** the entire existing `npm run e2e` + `npm test` must stay green — proof that
  Mathematics UX and generation are unchanged.

## 12. Success criteria (Phase 1)

- The sidebar shows a Thinking Skills section (after Mathematics) with the 7 exact subsections.
- An admin generates a 4-option Thinking Skills worksheet from the **Admin UI** and from **coach chat**,
  using the same engine as Mathematics (verifier, skill-tag, de-dup, save-unassigned, assign); the
  generated questions match the PDF difficulty/format and can include `fold-cut` / `target` figures.
- A student takes an assigned Thinking Skills worksheet and **cannot see the correct answer or
  explanation until submitting**; the admin always can.
- **No Mathematics regression:** every existing e2e/unit test passes unchanged, and Math generation
  (UI + chat) behaves byte-for-byte as before.

## 13. Guidance for implementing agents

- **Additive & subject-guarded:** never change a default that would alter Math. `subject` defaults to
  `'math'`; new params default to Math's current values; new routes/filters are opt-in.
- **One generation engine:** do not fork the generator — parametrize it. `generateMathWorksheet`
  remains the Math entry point (thin wrapper over the shared core).
- **Follow existing patterns:** Admin generate mirrors the math generate card; chat mirrors
  `generate_worksheet`; figures mirror the existing `StimulusFigure` kinds; seeds mirror the math seed.
- **Answer-key rule (§0/§10)** is checked for every student-reachable response.
- **The mandatory 5-step workflow** applies to every work item.
