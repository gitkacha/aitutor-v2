# Work Log

The single source of truth for work items — bugs, features, and review findings. One checkbox
per item.

**Rules** (see also CLAUDE.md → "Work log"):

- Before starting work, add an unchecked item here (or claim an existing one).
- Tick an item **only with proof**: the e2e spec (or test run) that demonstrates it, plus the
  commit hash. "It should work now" does not tick a box.
- Never delete items; superseded ones get a strike-through note instead.
- IDs from `docs/review.md` are reused (C/H/M/L/T). New items get sequential `W-n` IDs.

## Open

- [ ] **H1** — Auto-submit with an empty writing attempt 400s and strands the student (`docs/review.md` §High)
- [ ] **H2** — Async route errors bypass the Express error middleware; unhandled failures hang requests (`docs/review.md` §High)
- [ ] **H3** — Multi-type writing worksheets silently drop all but the first selected type (`docs/review.md` §High)
- [ ] **M2** — "All Topics" test isn't capped at 35 questions, and shuffling splits stimulus groups (`docs/review.md` §Medium)
- [ ] **M3** — `GET /api/math/attempts?topic=<bad-slug>` drops the filter and returns everything (`docs/review.md` §Medium)
- [ ] **M5** — Heatmap shows "Loading…" forever on fetch errors; loading and error states conflated (`docs/review.md` §Medium)
- [ ] **L2** — Replace hand-rolled countdown timer and heatmap with mature libraries, per CLAUDE.md guidance (`docs/review.md` §Look & feel)
- [ ] **W-5** — Minor sweep from `docs/review.md` §Minor: `postinstall` runs `migrate dev`; fallback prompt count mismatch (1 vs 3); `fetchJSON` sends Content-Type on GETs; math heatmap re-parses `topicBreakdown` per topic

## Done

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
