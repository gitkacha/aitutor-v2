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

- [ ] **M2** — "All Topics" test isn't capped at 35 questions, and shuffling splits stimulus groups (`docs/review.md` §Medium)
- [ ] **M3** — `GET /api/math/attempts?topic=<bad-slug>` drops the filter and returns everything (`docs/review.md` §Medium)
- [ ] **M5** — Heatmap shows "Loading…" forever on fetch errors; loading and error states conflated (`docs/review.md` §Medium)
- [ ] **L2** — Replace hand-rolled countdown timer and heatmap with mature libraries, per CLAUDE.md guidance (`docs/review.md` §Look & feel)
- [ ] **W-5** — Minor sweep from `docs/review.md` §Minor: `postinstall` runs `migrate dev`; fallback prompt count mismatch (1 vs 3); `fetchJSON` sends Content-Type on GETs; math heatmap re-parses `topicBreakdown` per topic

## Done

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
