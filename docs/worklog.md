# Work Log

The single source of truth for work items — bugs, features, and review findings. One checkbox
per item.

**Rules** (see CLAUDE.md → "Mandatory workflow — every work item, no exceptions"; these bind
every agent, on any model, without exception):

- Items are created **only after the user has approved a plan** (workflow step 2), and always
  **before any code is written**.
- Manual testing may be requested **only after e2e verification is fully green** (new spec plus
  the full `npm run e2e` and `npm test` suites) — never hand unverified work to the user.
- Tick an item **only after the user has manually tested and explicitly approved** (workflow
  step 5), and only with proof: the e2e spec (or test run) that demonstrates it, plus the commit
  hash. Passing tests alone, or "it should work now", does not tick a box.
- Never delete items; superseded ones get a strike-through note instead.
- IDs from `docs/review.md` are reused (C/H/M/L/T). New items get sequential `W-n` IDs.

## Open

Milestone 2 — multi-user, multi-tenant workspaces. Plan approved 2026-07-18:
`docs/superpowers/plans/Milestone2-plan.md`. Phases must land in order (A → B → C → D);
B1∥B2 and C1∥C2 may run in parallel worktrees, merging only with their proving specs
green. The full suite must be green at every phase boundary.

- [ ] **W-9** — Phase A · Foundation (serial): Workspace/User schema + migration with
  demo-workspace backfill; identity-provider auth service (local bcrypt implementation) +
  cookie session + requireAuth/requireAdmin; first-run setup flow; seed e2e/demo users;
  e2e harness upgrade (login helpers + storageState fixtures) with all existing specs
  authenticated and green.
- [ ] **W-10** — Phase B1 · Backend scoping (parallel with W-11): every route behind
  requireAuth + the scoping contract; authz e2e negative paths (student ↛ other student,
  student ↛ admin APIs, admin ↛ other workspace).
- [ ] **W-11** — Phase B2 · Frontend auth shell (parallel with W-10): login/logout/setup
  screens, auth context + route guards, sidebar identity, student app scoped to self.
- [ ] **W-12** — Phase C1 · Admin experience (parallel with W-13): student picker at
  worksheet save (assignments), per-student performance views, workspace members
  management.
- [ ] **W-13** — Phase C2 · Student experience (parallel with W-12): assigned-pending
  lists everywhere, opportunity areas, negative-path e2e hardening.
- [ ] **W-14** — Phase D · Integration (serial): full suites + typecheck; live fresh-DB
  multi-user walkthrough + demo-workspace verification; migration dry-run against a copy
  of dev.db; README + CLAUDE.md updates.

## Done

- [x] **L14** — Polish sweep: worksheet save 400s on types/prompts count mismatch, `timeTaken == null` rejected, `|| 10` fallback and hardcoded "20 topic categories" removed, AttemptDetail spinner label fixed, demo data fully deterministic, grid label-length validation in both stimulus libs — commits `c95edf4` (backend), `27eb5a8` (frontend) · proof: `e2e/l3-l14.spec.ts` (L14 test) + `stimulus.test.ts` grid-label cases · user signed off 2026-07-18
- [x] **L13** — MathQuestionCard rendered placeholder A–E options on parse failure; corrupt options now show an explicit error via `parseOptions` — commit `27eb5a8` · proof: `frontend/src/__tests__/parse.test.ts` · user signed off 2026-07-18
- [x] **L12** — Error middleware leaked raw internals and always 500'd; now honours `err.status` (malformed JSON → 400) and returns a generic message for true 500s — commit `c95edf4` · proof: `e2e/l3-l14.spec.ts` (L12 test) · user signed off 2026-07-18
- [x] **L11** — `GeneratedMathQuestion.stimulus` typed; `(q as any)` casts removed from Admin — commit `27eb5a8` · proof: typecheck + w8 e2e regression · user signed off 2026-07-18
- [x] **L10** — Math worksheet titles now use topic names via `mathWorksheetTitle()`; discoverability half needed no change (the All Topics page lists every worksheet) — commit `27eb5a8` · proof: `frontend/src/__tests__/math-worksheet-title.test.ts` · user signed off 2026-07-18
- [x] **L9** — Backend typecheck fixed (tsconfig rootDir dropped; `@types/express` pinned to the Express 4 major, which the working typecheck surfaced); `typecheck` scripts added to both workspaces + root — commit `c95edf4` · proof: `npm run typecheck` passes · user signed off 2026-07-18
- [x] **L8** — Sidebar fetched both full attempt lists per navigation and demo attempts inflated the momentum ring; new `GET /api/stats` (non-demo weekly count), sidebar uses it — commits `c95edf4`/`27eb5a8` · proof: `e2e/l3-l14.spec.ts` (L8 tests) + live check (stats unchanged through a 44-attempt demo load) · user signed off 2026-07-18
- [x] **L7** — Timer `running` contract narrowed to one-way with rationale (the exam clock never pauses; resume would offset the fixed end timestamp) — commit `27eb5a8` · docs-only · user signed off 2026-07-18
- [x] **L6** — Empty heatmap data no longer renders as an eternal load; "No heatmap data available." + Admin math heatmap loading prop — commit `27eb5a8` · proof: `e2e/l3-l14.spec.ts` (L6 test) + `docs/screenshots/l6-heatmap-empty.png` · user signed off 2026-07-18
- [x] **L5** — Unguarded `JSON.parse` of worksheet JSON in five components; shared `parseJsonArray` guards them all — commit `27eb5a8` · proof: `frontend/src/__tests__/parse.test.ts` · user signed off 2026-07-18
- [x] **L4** — ScoreHistory swallowed fetch errors into the empty state; error panel with retry, truncation-only ellipsis, ternary cleanup — commit `27eb5a8` · proof: `e2e/l3-l14.spec.ts` (L4 test) + `docs/screenshots/l4-history-error.png` · user signed off 2026-07-18
- [x] **L3** — Writing routes 500'd on non-numeric ids; now 400 like the math routes — commit `c95edf4` · proof: `e2e/l3-l14.spec.ts` (L3 test) · user signed off 2026-07-18

- [x] **M10** — `POST /api/math/attempts` trusted the client payload (mismatched/non-integer/empty arrays, duplicate or unknown question ids accepted; unknown topicId → 500 FK error); all now rejected with 400s, valid payloads score as before — commit `99719b2` · proof: `e2e/m6-m10.spec.ts` (M10 test: six bad payloads 400, valid 201 with correct score) · user signed off 2026-07-18
- [x] **M9** — All Topics page claimed every math attempt as its history/average; now filtered to `topicId === null && source === 'practice'` — commit `d2ebe55` · proof: `e2e/m6-m10.spec.ts` (M9 test) + `docs/screenshots/m9-all-topics-history.png` · user signed off 2026-07-18
- [x] **M8** — PracticeHome average counted unanalysed attempts as 0; now averages only attempts with an analysis score (matches heatmap/ScoreHistory) — commit `3071dbe` · proof: `e2e/m6-m10.spec.ts` (M8 test) + `docs/screenshots/m8-practice-average.png` · user signed off 2026-07-18
- [x] **M7** — Demo writing worksheet was pre-H3 shape (3 prompts, "Persuasive + Discussion" title, two prompts unreachable; Admin hardcoded "1 prompt"); demo now creates two one-prompt worksheets with H4-consistent Prompt rows, demo clear removes attempt-free demo prompts, Admin label derived — commit `7d05105` · proof: `e2e/m6-m10.spec.ts` (M7 test) + `docs/screenshots/m7-demo-worksheets.png` · user signed off 2026-07-18
- [x] **M6** — Failed math test submission was silent (console-only catch, frozen test); now shows the H1-style "We couldn't save your answers / Try Again" panel — commit `64e5cea` · proof: `e2e/m6-m10.spec.ts` (M6 test: aborted save shows panel, retry lands on review) + `docs/screenshots/m6-save-error.png` · user signed off 2026-07-18

- [x] **H4** — Worksheet writing attempts were analysed against the wrong prompt (bank prompt attached as `promptId` while the student answered the worksheet's generated prompt); worksheet save now creates a real `Prompt` row (`source: 'worksheet'`), `POST /api/attempts` resolves the worksheet prompt server-side (covers pre-fix worksheets), bank-prompt hack removed from PracticeHome/PendingWorksheets/Sidebar via shared `lib/worksheet-start.ts`, worksheet prompts excluded from random practice — commit `296192f` · proof: `e2e/h4-worksheet-prompt.spec.ts` + live gpt-4o-mini analysis grading the worksheet prompt (`docs/screenshots/h4-*`) · user signed off 2026-07-18
- [x] **H5** — Deleting a math worksheet promoted its persisted questions into topic practice banks (`ON DELETE SET NULL` + banks defined as `worksheetId: null`, reachable via the demo load → start → clear cycle); `MathQuestion.worksheet` is now `ON DELETE CASCADE` and `clearDemoData` sweeps emptied stimulus groups. Known trade-off: a real attempt on a demo worksheet loses question detail after demo clear (the attempt row survives) — commit `a938623` · proof: `e2e/h5-worksheet-delete-leak.spec.ts` (topic banks byte-identical across the demo cycle) · user signed off 2026-07-18

- [x] **W-5** — Minor sweep: `postinstall` → `prisma migrate deploy` (new `db:deploy`); `fetchJSON` sends Content-Type only on bodied requests (placeholder frontend suite replaced with real tests); math heatmap single-pass aggregation (`aggregateMathHeatmap`); fallback prompt count already superseded by H3's per-type generation — commit `e862c68` · proof: `frontend/src/__tests__/api.test.ts`, `backend/src/__tests__/math-heatmap-aggregate.test.ts`, fresh-db install simulation · user signed off 2026-07-17
- [x] **L2** — Countdown now timestamp-driven via `react-countdown` (no drift, keeps counting in background tabs, survives Timer unmounts); heatmap deliberately stays custom (semantic card grid — reviewer concurred; exception recorded in CLAUDE.md) — commit `55c852c` · proof: `e2e/l2-timer.spec.ts` (clock-jump drift test) + 40/40 e2e regression net + live 0s-drift check · user signed off 2026-07-17
- [x] **M5** — Heatmap conflated loading and error; now distinct states with Try Again, per-section on Dashboard (one failed subject no longer hides the other), Admin errors surfaced — commit `c51eea1` · proof: `e2e/m2-m3-m5.spec.ts` (M5 tests) + `docs/screenshots/m5-*` · user signed off 2026-07-17
- [x] **M3** — Unknown topic filter on `GET /api/math/attempts` returned everything; now 404s like math-questions — commit `431fb16` · proof: `e2e/m2-m3-m5.spec.ts` (M3 tests) · user signed off 2026-07-17
- [x] **M2** — All Topics test capped at 35 with stimulus groups kept whole and adjacent (`selectTestQuestions` unit shuffle); single-topic keeps full bank — commit `2689846` · proof: `e2e/m2-m3-m5.spec.ts` (M2 test) + `backend/src/__tests__/question-select.test.ts` · user signed off 2026-07-17
- [x] **W-8** — Visual stimuli for math questions: structured figure specs (protractor, line/bar/pie charts, grids, tables, compass, shapes, rotation, cards) rendered in practice/review/admin; generation emits + verifier re-solves from stimuli; guardrail discards visual references without figures; seed repair from T5 images (10 questions); attempt-review stimulus display added; seed made re-runnable on live dbs — commit `67c13f6` · proof: `e2e/w8-visual-stimuli.spec.ts` (5 tests) + `backend/src/__tests__/stimulus.test.ts` + live screenshots (`docs/screenshots/w8-*`) · user signed off 2026-07-17
- [x] **H3** — Multi-type writing worksheets kept only `typeIds[0]`; now one tailored prompt and one worksheet per selected type — commit `fcb3245` · proof: `e2e/h3-multitype-worksheet.spec.ts` (2 tests) + live screenshots · user signed off 2026-07-17
- [x] **H1** — Empty-text auto-submit 400'd and stranded the student at 0:00; empty attempts now save, failures show a visible Try Again panel — commit `eb4e23a` · proof: `e2e/h1-empty-submit.spec.ts` (3 tests, incl. clock-driven 30-min expiry) + live screenshot · user signed off 2026-07-17
- [x] **H2** — Async route errors bypassed the error middleware (a malformed body crashed the backend); all 24 handlers wrapped in `asyncHandler`, defensive JSON parsing — commit `7653b97` · proof: `e2e/h2-async-errors.spec.ts` (2 tests) + `backend/src/__tests__/async-handler.test.ts` · user signed off 2026-07-17
- [x] **W-7** — Five-step workflow (plan approval → worklog items → implement → verify e2e → manual test + user sign-off before ticking) made mandatory in CLAUDE.md and worklog rules, incl. full-e2e-green gate before manual testing — commits `271afca`, `4c8b690` · proof: docs-only, user reviewed and approved 2026-07-17
- [x] **W-6** — Work log + verification/testing guidelines (this file, CLAUDE.md sections) — commit: see git log · proof: docs-only, proofread
- [x] **W-4** — "Evening Navy" sidebar: momentum ring, colour-coded nav scores, Up-next card, focus mode; replaces the gradient WIP — commit `1ad7d2c` · proof: `e2e/sidebar-navy.spec.ts` (4 tests) + live screenshots
- [x] **L1** — Sidebar gradient (banned element) removed by the Evening Navy redesign — commit `1ad7d2c` · proof: `e2e/sidebar-navy.spec.ts`, CLAUDE.md Look-and-feel note
- [x] **W-3** — `/math-history/:slug` endless spinner (route param `topicSlug` vs `typeSlug`) + worksheet questions leaking into topic banks — commit `13a52ad` · proof: `e2e/math-history.spec.ts`
- [x] **W-2** — Model split (`gpt-5-mini` generation + verification, `gpt-4o-mini` analysis) with independent answer-key verifier and duplicate-option rejection — commit `13a52ad` · proof: `e2e/model-split-verifier.spec.ts` + live 6/6 hand-checked worksheet
- [x] **W-1** — Exact-count batched worksheet generation (25-of-35 bug), admin-chosen question count, 1-min/question total budget, pending-worksheets quick view — commit `13a52ad` · proof: `e2e/worksheet-enhancements.spec.ts`
- [x] **M1** — Single-call generation with no output validation / placeholder fallback — superseded by W-1/W-2 (batching, schema validation, verifier, 502 on failure) — commit `13a52ad` · proof: `e2e/worksheet-enhancements.spec.ts`, `e2e/model-split-verifier.spec.ts`
- [x] **M4** — Analyses write-once with no retry — failed analyses are never persisted; attempt page gets an error panel with Retry — commit `13a52ad` · proof: `e2e/c4-analysis.spec.ts`
- [x] **T1** — No real e2e coverage — isolated Playwright stack (fresh `e2e.db`, ports 3105/5273, stubbed OpenAI) with 22 passing tests — commits `13a52ad`, `1ad7d2c` · proof: `npm run e2e`
- [x] **C4** — AI provider broken (OpenRouter/free-model 404s, fake zero scores persisted); migrated to OpenAI, plus latent bug: backend never loaded `.env` — commit `13a52ad` · proof: `e2e/c4-analysis.spec.ts` + live gpt-4o-mini call
- [x] **C2/C3** — Worksheet attempts scored against wrong questions; placeholder options rendered — worksheet questions persisted as real `MathQuestion` rows — commit `13a52ad` · proof: `e2e/c2-c3-worksheet.spec.ts`
- [x] **C1** — Math timed practice auto-submits immediately on load — commit `13a52ad` · proof: `e2e/c1-math-timer.spec.ts`
