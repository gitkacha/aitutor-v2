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

- [ ] **L3** — Writing routes 500 on non-numeric ids (`GET /api/attempts/:id`,
  `POST /api/analysis/:attemptId`); guard → 400. Proof: `e2e/l3-l14.spec.ts` (L3 test)
- [ ] **L4** — ScoreHistory swallows fetch errors into the empty state; add M5-style error
  panel with retry, fix always-appended ellipsis and redundant ternary.
  Proof: `e2e/l3-l14.spec.ts` (L4 test)
- [ ] **L5** — Unguarded `JSON.parse` of worksheet JSON in five components; shared
  `parseJsonArray` helper. Proof: `frontend/src/__tests__/parse.test.ts`
- [ ] **L6** — Heatmap shows "Loading…" for genuinely empty data; split loading vs empty,
  give Admin math heatmap its missing loading prop. Proof: `e2e/l3-l14.spec.ts` (L6 test)
- [ ] **L7** — Timer `running` prop can pause but never resume; contract narrowed to one-way
  (exam clock never pauses) with an explanatory comment. Docs-only.
- [ ] **L8** — Sidebar fetches both full attempt lists on every navigation just to count
  sessions, and demo attempts inflate the momentum ring; new `GET /api/stats`
  (non-demo `sessionsThisWeek`), sidebar uses it. Proof: `e2e/l3-l14.spec.ts` (L8 tests)
- [ ] **L9** — Backend `tsc --noEmit` fails (TS6059 rootDir/prisma); fix tsconfig, add
  `typecheck` scripts to both workspaces + root. Proof: `npm run typecheck` passes.
- [ ] **L10** — Math worksheet titles use slugs; build from topic names via unit-tested
  helper. (Discoverability half: no change — the All Topics page lists every worksheet.)
  Proof: `frontend/src/__tests__/math-worksheet-title.test.ts`
- [ ] **L11** — Frontend `GeneratedMathQuestion` lacks `stimulus`; add the typed field, drop
  `(q as any)` casts in Admin. Proof: typecheck + w8 e2e regression.
- [ ] **L12** — Error middleware leaks raw internal messages and always 500s; honour
  `err.status` (malformed JSON → 400), generic message for true 500s.
  Proof: `e2e/l3-l14.spec.ts` (L12 tests)
- [ ] **L13** — MathQuestionCard renders placeholder A–E options on parse failure; render an
  explicit error instead. Proof: `frontend/src/__tests__/parse.test.ts` (parseOptions)
- [ ] **L14** — Polish sweep: worksheet save 400 on types/prompts count mismatch;
  `timeTaken == null` rejection; drop `|| 10` fallback + hardcoded "20"; AttemptDetail
  spinner label; demo determinism + unused var; grid label-length validation in both
  stimulus libs. Proof: `e2e/l3-l14.spec.ts` (L14 test) + `stimulus.test.ts` additions

## Done

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
