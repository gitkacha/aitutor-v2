# Thinking Skills — Phase A (Practice + Progress Signals) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement
> this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Thinking Skills to Mathematics parity for the *student practice experience* and
*progress surfacing*, plus fix a latent option-count copy bug — while keeping generate-on-demand
practice (user's decision) and zero regression to Writing / Mathematics / existing flows.

**Architecture:** Thinking Skills already reuses the generalized subject-aware MCQ stack
(`MathTopic.subject`, shared `MathQuestion`/`MathWorksheet`/`MathAttempt` tables, one generation
engine). Phase A is additive and subject-guarded: every new branch defaults to existing Math
behaviour. Generate-on-demand practice persists a `kind:"self-practice"` worksheet (so the attempt
and review can reference real question IDs) that is hidden from the admin list and never assigned.

**Tech Stack:** Vite + React + TS (frontend), Express + Prisma + SQLite (backend); Playwright e2e on
the isolated stack (backend 3105 / frontend 5273 / OpenAI stub 3106, fresh `e2e.db`); vitest units.

## Global Constraints

- ZERO regression to Writing / Mathematics / any existing flow. The full `npm run e2e` + `npm test`
  suites (with the unchanged Writing/Math specs) are the regression net.
- Every new column/branch/filter defaults to existing behaviour (`kind` defaults `"standard"`;
  practice-generate is Thinking-Skills-only; subject params default to `'math'`).
- Answer-key hygiene stays intact: students never see `correctIndex`/`explanation` before submit.
- RED-first: each behaviour starts with a failing Playwright e2e (or vitest) test, watched fail for
  the right reason, then GREEN. Full suites + `npm run typecheck` before handover. Live screenshot
  check for the UI changes.
- Thinking Skills = 4 options (A–D); Mathematics = 5 options (A–E). Copy must be subject-correct.
- Per-item worklog ticks only after user manual sign-off (commit hash + proving spec).

---

### Task A1 (W-100): Subject-aware option-count copy

**Files:**
- Modify: `frontend/src/pages/MathPracticeHome.tsx` (Test Format list — the "5 answer options (A-E)"
  line, ~line 140)
- Modify: `frontend/src/pages/MathTimedPractice.tsx` (start screen "5 options each", ~line 170)
- Test: `e2e/tsA-practice-copy.spec.ts` (new)

**Interfaces:**
- Consumes: `MathTopic.subject` (already on the payload from `GET /math/topics` / `getTopic`; verify
  the single-topic route returns `subject` and add it to the select if missing).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Write the failing e2e** — as a student, open a Thinking Skills section practice page
  (`/math/visual-reasoning`); assert the Test Format shows "4 answer options" / "A–D" and NOT
  "5"/"A-E". Then open a Mathematics topic page and assert it still shows "5 answer options (A-E)"
  (regression guard). Start-screen: assert the TS timed-practice start screen reads "4 options each".
- [ ] **Step 2: Run it, watch it fail** (`npx playwright test e2e/tsA-practice-copy.spec.ts`) — TS
  page shows the wrong "5 (A-E)" copy today.
- [ ] **Step 3: Implement** — in both files derive `const opts = topic.subject === 'thinking-skills'
  ? { count: 4, label: 'A–D' } : { count: 5, label: 'A-E' }` and render
  `{opts.count} answer options per question ({opts.label})` / `{opts.count} options each`. If
  `getTopic` doesn't return `subject`, add it to the route's select.
- [ ] **Step 4: Run it, watch it pass**; run the affected Math specs too.
- [ ] **Step 5: Commit** `feat(thinking-skills): subject-aware option-count copy in practice (W-100)`.

### Task A2 (W-101): Generate-on-demand self-serve practice

**Files:**
- Modify: `backend/prisma/schema.prisma` (`MathWorksheet.kind String @default("standard")`) + new
  migration
- Create: `backend/src/routes/math-practice.ts` (or add to `math-worksheets.ts`) — practice-generate
  endpoint
- Modify: `backend/src/routes/math-worksheets.ts` (GET `/` list excludes `kind:"self-practice"`),
  `backend/src/index.ts` (mount, if a new router)
- Modify: `frontend/src/lib/api.ts` (`mathApi.generatePractice` + poll), `MathPracticeHome.tsx`
  (TS "Start Timed Practice" → generate then navigate), `MathTimedPractice.tsx` (honor
  `generatedPractice` nav flag: source `"practice"`, credit topic, 69s/q)
- Test: `e2e/tsA-practice-generate.spec.ts` (new); backend units
  `backend/src/__tests__/math-practice-generate.test.ts`

**Interfaces:**
- Consumes: shared `generateMathWorksheet(topicSlugs, count, workspaceId)` (derives subject +
  optionCount), the existing background-job helpers (`createJob`/`getJobForWorkspace`).
- Produces: `POST /api/math/practice/generate { topicSlug }` → `{ jobId }`; `GET
  .../practice/jobs/:jobId` → `{ status, result: { worksheetId }, error }`. Frontend
  `mathApi.generatePractice(topicSlug)` + `getPracticeJob(jobId)`.

- [ ] **Step 1: Failing backend unit** — calling the practice-generate service for a
  `thinking-skills` section persists a `MathWorksheet` with `kind:"self-practice"`, unassigned,
  `createdById` = the caller, plus its question rows; a non-TS slug is rejected.
- [ ] **Step 2: Failing e2e** — student on a TS section clicks Start Timed Practice → (stubbed)
  generation → timed practice runs → submit → attempt review renders the questions; AND the
  self-practice worksheet does NOT appear in the admin Saved Worksheets list.
- [ ] **Step 3: Run both, watch fail** (route/column/flag missing).
- [ ] **Step 4: Migration + column** — add `kind` (default `"standard"`); `prisma migrate dev
  --name add_worksheet_kind`; confirm existing rows backfill to `"standard"`.
- [ ] **Step 5: Backend endpoint** — `POST /math/practice/generate` (requireAuth): 400 unless the
  topic exists and `subject === 'thinking-skills'`; `createJob` → `generateMathWorksheet([slug],
  DEFAULT_PRACTICE_COUNT, workspaceId)` → persist a `MathWorksheet(kind:'self-practice', createdById:
  user.id, topicIds: JSON.stringify([slug]))` + question rows (reuse the same persistence the
  save-worksheet path uses), return `{ worksheetId }`. Add the poll route.
- [ ] **Step 6: List hygiene** — GET `/math/worksheets` where-clause gains `kind: 'standard'` (or
  `NOT { kind: 'self-practice' }`) for both admin and student branches; verify the admin list unit.
- [ ] **Step 7: Frontend** — `mathApi.generatePractice`/`getPracticeJob`; in `MathPracticeHome`, for
  a TS topic the Start button generates (spinner state) then `navigate('/math/<slug>/start', { state:
  { worksheetId, generatedPractice: true } })`; in `MathTimedPractice`, when
  `generatedPractice` is set, fetch by `worksheetId` but record the attempt as practice
  (`source:'practice'`, `topicId` = section, 69s/q).
- [ ] **Step 8: Run both suites green**; typecheck.
- [ ] **Step 9: Commit** `feat(thinking-skills): generate-on-demand self-serve practice (W-101)`.

### Task A3 (W-102): Sidebar Thinking Skills score tiles + badges

**Files:**
- Modify: `frontend/src/components/Sidebar.tsx`
- Test: `e2e/tsA-sidebar-scores.spec.ts` (new)

**Interfaces:**
- Consumes: `mathApi.getHeatmap(undefined, 'thinking-skills')` (existing), `ScoreBadge`/`band`/
  `stripFill` (already in the file).

- [ ] **Step 1: Failing e2e** — after a scored TS attempt, the sidebar Thinking Skills section shows
  a `%` score badge for that section (and the collapsed strip renders tiles).
- [ ] **Step 2: Run it, watch fail** (no badges today; the Phase-1 comment defers them).
- [ ] **Step 3: Implement** — add `thinkingScores` state loaded from the TS heatmap (mirror
  `mathScores`); render `<ScoreBadge>` per TS link and the collapsed-strip tiles; remove the
  "tiles arrive in Phase 2" comment.
- [ ] **Step 4: Run it green**; run `e2e/ts-sidebar.spec.ts` (Phase-1 sidebar) as a regression guard.
- [ ] **Step 5: Commit** `feat(thinking-skills): sidebar score tiles + badges (W-102)`.

### Task A4 (W-103): Dashboard Opportunity Areas include Thinking Skills

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx` (`opportunityAreas`)
- Test: `e2e/tsA-opportunity-areas.spec.ts` (new)

**Interfaces:**
- Consumes: `thinkingData` (already loaded on the page via `loadThinking`).

- [ ] **Step 1: Failing e2e** — with a weak TS section (scored attempt), the Dashboard Opportunity
  Areas panel lists that section, linking to `/math/<slug>`.
- [ ] **Step 2: Run it, watch fail** (opportunityAreas takes only writing+math today).
- [ ] **Step 3: Implement** — extend `opportunityAreas(writing, math, thinking)` to fold TS entries
  (`key: 't-<slug>'`, path `/math/<slug>`) into the same weakest-4 sort; pass `thinkingData` at the
  call site.
- [ ] **Step 4: Run it green**; confirm the existing dashboard/opportunity specs still pass.
- [ ] **Step 5: Commit** `feat(thinking-skills): opportunity areas include Thinking Skills (W-103)`.

---

## Verification (definition of done)

Per task: RED→GREEN on its new spec, then full `npm run e2e` + `npm test` + `npm run typecheck` green
before moving on. After A4: a `npm run dev` live screenshot review of the affected screens (TS
practice page, timed-practice start, an expanded attempt review, the sidebar with scores, the
dashboard opportunity areas). Then hand over for manual testing; tick each W-item only after user
sign-off (commit hash + proving spec).

## Self-review notes

- `kind` defaults `"standard"` so every existing worksheet row and the admin list are unchanged.
- Self-practice worksheets are unassigned → students never see them in pending/up-next; the admin
  list explicitly excludes `kind:"self-practice"`.
- The generate-on-demand attempt is recorded as `source:"practice"` (not `"worksheet"`) so it counts
  as self-serve practice and credits the section in the heatmap via `topicBreakdown`.
