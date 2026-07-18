# Project Review 2 — NSW Selective Prep Coach

**Reviewed:** 2026-07-18, at commit `2e4bdaf` (clean working tree).
**Scope:** full read-through of backend and frontend source, Prisma schema and migrations,
seed and demo services, the AI service layer, all pages/components, test infrastructure
(unit + e2e), and configs. This is the follow-up to `docs/review.md` (2026-07-16); all 15
findings from that review are fixed and ticked in `docs/worklog.md`, so everything below is new.

**Finding IDs continue the first review's sequences** (that review ended at H3, M5, L2), so
these can be claimed in `docs/worklog.md` without collisions.

> **Update (2026-07-18):** **H4 and H5 are fixed.** Each was first reproduced by a failing
> Playwright e2e test, then fixed, then proven green — see `e2e/h4-worksheet-prompt.spec.ts`
> (worksheet attempts now reference the worksheet's own `Prompt` row, resolved server-side,
> and the analysis request carries that prompt) and `e2e/h5-worksheet-delete-leak.spec.ts`
> (`MathQuestion.worksheetId` is now `ON DELETE CASCADE`; the demo load → start → clear cycle
> leaves every topic bank unchanged). Full suites: 42/42 e2e, 21/21 unit. H4 was additionally
> verified live with a real gpt-4o-mini analysis that graded against the worksheet prompt.
> The Medium/Low findings below remain open; status tracking lives in `docs/worklog.md`.

> **Update (2026-07-18, later):** **M6–M10 are fixed**, proven by `e2e/m6-m10.spec.ts`
> (five tests, all watched RED first): the math test now shows a visible "couldn't save /
> Try Again" panel (M6); demo writing worksheets follow the one-prompt-per-type model with
> H4-consistent Prompt rows and a derived Admin label (M7); type averages cover only
> analysed attempts (M8); the All Topics page lists only All Topics tests (M9); and
> `POST /api/math/attempts` rejects malformed payloads — mismatched/non-integer/empty
> arrays, duplicate or unknown question ids, unknown topicId — with 400s (M10).
> Full suites: 47/47 e2e, 21/21 unit. Only the Low findings remain open.

> **Update (2026-07-18, final):** **L3–L14 are fixed** — see `e2e/l3-l14.spec.ts` plus new
> unit suites (`parse.test.ts`, `math-worksheet-title.test.ts`, grid-label cases in
> `stimulus.test.ts`). Highlights: non-numeric ids 400 (L3); ScoreHistory error panel with
> retry (L4); `parseJsonArray`/`parseOptions` guard all worksheet JSON and corrupt options
> render an explicit error (L5/L13); empty heatmap data shows "no data" (L6); the Timer's
> one-way `running` contract is documented (L7); the sidebar counts sessions via the new
> `GET /api/stats` (demo excluded) instead of fetching full attempt lists (L8);
> `npm run typecheck` now passes in both workspaces — fixing the tsconfig also surfaced and
> fixed a wrong `@types/express` major (L9); math worksheet titles use topic names (L10);
> `GeneratedMathQuestion.stimulus` is typed (L11); the error middleware honours client-error
> statuses and never leaks internals (L12); and the L14 polish sweep landed (count-mismatch
> 400, `timeTaken == null`, deterministic demo data, grid label validation, label fixes).
> **This closes the entire review-2 backlog.**

---

## 1. State of the app

The app is in good shape. The first review's backlog is genuinely cleared: worksheet questions
are persisted as real `MathQuestion` rows, the AI layer runs on OpenAI with a generation/
verification model split and an independent answer-key audit, visual stimuli are structured
specs rendered as real figures, timers are timestamp-driven, async route errors are contained,
and the e2e stack (isolated DB, stubbed OpenAI) covers the critical paths.

**Verified during this review:**

- `npm test` — 21/21 unit tests pass (19 backend, 2 frontend).
- `npm run e2e` — 40/40 Playwright tests pass on the isolated stack.
- `tsc --noEmit` — frontend clean; **backend fails** with TS6059 (see L9).

**What's improved since review 1 (worth keeping this way):**

- Every route handler is wrapped in `asyncHandler`; a malformed body can no longer crash the
  process.
- Generated math questions are validated structurally, checked for duplicate option values,
  re-solved by an independent verifier call, and rejected if they reference a visual without
  carrying one.
- The stimulus spec is validated identically on both sides (`backend/src/lib/stimulus.ts` and
  `frontend/src/lib/stimulus.ts` are byte-identical apart from the header comment).
- Loading vs error are distinct states on the heatmaps, with retry.
- The seed is re-runnable against live databases without violating FKs.

The findings below are mostly consistency gaps and latent hazards — nothing corrupts scores in
the primary practice flows.

---

## 2. Review Findings

### High

**H4. Worksheet writing attempts are analysed against the wrong prompt**
`frontend/src/pages/PracticeHome.tsx:42-51`, `frontend/src/components/PendingWorksheets.tsx:44-52`,
`frontend/src/components/Sidebar.tsx:128-135` → `backend/src/services/ai.service.ts:130`

When a student starts a writing worksheet, the UI shows the worksheet's generated prompt
(`worksheetPromptText`) but attaches the **type's first bank prompt** as the attempt's
`promptId` ("Use the first real prompt from the type for FK compliance"). The AI analysis then
builds its grading prompt from `attempt.prompt.text` — i.e. the unrelated bank prompt, not the
prompt the student actually answered. The content score explicitly judges "how well it follows
the expected structure" against the wrong task, so worksheet feedback (and the heatmap scores it
feeds) is graded against a prompt the student never saw.

Secondary failure: if a type has no bank prompts, the fallback is `{ id: 0, … }`, and
`POST /api/attempts` rejects `promptId: 0` as missing — the student lands on the H1 "Try Again"
error panel with a retry that can never succeed.

**Fix:** persist the worksheet's prompt as a real `Prompt` row when the worksheet is saved
(`worksheets.ts /save` already creates one worksheet per type — create the `Prompt` there and
store its id in the worksheet), so attempts reference the true prompt and the analysis grades the
right task. The three copies of this start-worksheet logic (PracticeHome, PendingWorksheets,
Sidebar) should collapse into one helper at the same time.

**H5. Deleting a math worksheet silently leaks its questions into the topic practice banks**
`backend/prisma/schema.prisma:94` (FK is `ON DELETE SET NULL`),
`backend/src/services/math-worksheet.service.ts:74-94`, `backend/src/services/demo.service.ts:255-265`

Worksheet questions are persisted as `MathQuestion` rows with `worksheetId` set, and every
topic-bank query filters `worksheetId: null`. But the FK is `ON DELETE SET NULL`, so deleting a
`MathWorksheet` doesn't remove or block on its question rows — it **nulls their `worksheetId`**,
which by definition promotes them into the regular practice banks.

This is reachable today through demo data: load demo → the student starts the demo math
worksheet (this lazily materialises its 10 questions as rows, and they are *not* flagged
`isDemo`) → "Clear Demo Data" deletes the worksheet → 10 duplicate questions permanently join
the Number Sentences / Probability banks. This is exactly the W-3 class of bug (worksheet
questions leaking into banks), reintroduced through the delete path. Note the demo math
worksheet also duplicates existing bank questions verbatim, which compounds the effect.

**Fix:** delete a worksheet's question rows (and their attempt-safe stimulus groups) in the same
transaction as the worksheet, or make materialised demo-worksheet rows `isDemo: true` and clear
them in `clearDemoData`; ideally both. A regression e2e: load demo, start demo worksheet, clear
demo, assert topic bank counts unchanged.

### Medium

**M6. A failed math test submission is completely silent**
`frontend/src/pages/MathTimedPractice.tsx:83-87`

The catch block logs to the console, resets `submitting`/`submittedRef`, and returns the student
to the question screen with no message — and with the timer already paused (`running` stays
`false`). H1 added a visible "We couldn't save your writing / Try Again" panel for exactly this
situation in writing; math needs the same treatment (a student whose 40-minute test fails to
save must be told, not returned to a frozen test).

**M7. The demo writing worksheet contradicts the post-H3 worksheet model**
`backend/src/services/demo.service.ts:95-106`, `frontend/src/pages/Admin.tsx:351`

The demo worksheet is titled "Worksheet: Persuasive + Discussion" but has a single `typeId`
(persuasive) and **three** prompts. Post-H3, a worksheet is one type + one prompt: students only
ever see `prompts[0]`, so two demo prompts are unreachable, and the title advertises a second
type that isn't there. Separately, the Admin saved-worksheets list hardcodes the label
"1 prompt ·" regardless of `prompts.length`. Update the demo fixture to the current model (two
worksheets, one per type, one prompt each) and derive the label from the data.

**M8. Writing averages count unanalysed attempts as zero**
`frontend/src/pages/PracticeHome.tsx:32-36`

`(a.analysis?.overallScore ?? 0)` divides by *all* attempts, so any attempt whose analysis is
pending or failed drags the shown average down as a 0. The backend heatmap correctly averages
only scored attempts — the type page should do the same (filter to `a.analysis` before
averaging, as `ScoreHistory` already does).

**M9. "All Topics" history claims every math attempt**
`frontend/src/pages/MathPracticeHome.tsx:20-27`

The All Topics page fetches `mathApi.getAttempts()` with no filter, so its "Your History" count,
average, and recent list include single-topic practice and worksheet attempts. A student who has
never taken an All Topics test still sees a full history there, and the average mixes 5-question
topic drills with 35-question tests. Filter to attempts with `topicId === null` and
`source === 'practice'` (or persist an explicit mode on the attempt).

**M10. `POST /api/math/attempts` trusts the client payload beyond parseability**
`backend/src/routes/math-attempts.ts:15-68`

The route checks the two JSON strings parse to arrays, but not what's in them:

- non-integer entries (objects, strings) are stored verbatim; `GET /:id` later does
  `findMany({ where: { id: { in: questionIds } } })` on them and 500s;
- `answers` shorter/longer than `questions` is accepted (missing answers simply score wrong);
- unknown question ids are skipped for scoring but still counted in `totalQuestions`, silently
  deflating the percentage;
- `questionIds: []` yields `totalQuestions: 0`, and the review page renders `NaN%`;
- an invalid `topicId` fails the FK and surfaces as a 500 rather than a 400.

Validate: both arrays are integer arrays of equal, non-zero length; every question id exists;
`topicId` (when present) exists. This hardens the trust boundary the same way H2/W-8 hardened
the AI boundary.

### Low

**L3. Writing routes 500 on non-numeric ids**
`backend/src/routes/attempts.ts:49`, `backend/src/routes/analysis.ts:9`
`parseInt('abc')` → `NaN` → Prisma throws → 500. The math routes guard this
(`math-attempts.ts:99-101`); mirror that with a 400.

**L4. `ScoreHistory` swallows fetch errors into the empty state**
`frontend/src/components/ScoreHistory.tsx:33,44`
`.catch(() => {})` renders a failed load as "No completed attempts with scores yet" — the exact
loading-vs-error conflation M5 removed from the heatmaps. Also cosmetic: the attempt preview
always appends `…` (even for short or empty texts), and `navigate(isMath ? '/dashboard' : '/dashboard')`
is a redundant ternary.

**L5. Unguarded `JSON.parse` of worksheet JSON across five components**
`PracticeHome.tsx:40,117`, `MathPracticeHome.tsx:46,155`, `PendingWorksheets.tsx:34,42,70,93`,
`Sidebar.tsx:120,126`, `Admin.tsx:340,527`
One malformed `prompts`/`topicIds`/`questions` value in the DB throws during render and
white-screens the page. `MathQuestionCard` shows the safe pattern (try/catch); a small
`parseJsonArray` helper would cover all of these.

**L6. Genuinely empty heatmap data displays as an eternal load**
`frontend/src/components/Heatmap.tsx:50`
`if (loading || data.length === 0)` shows "Loading heatmap data..." when the fetch succeeded
but returned `[]` (e.g. unseeded DB). Distinguish `loading` from an empty result.

**L7. `Timer` can pause but never resume**
`frontend/src/components/Timer.tsx:18-20`
The effect calls `api.pause()` when `running` flips false but never `api.start()` when it flips
true. No current caller un-pauses, but the prop contract implies it works — either support
resume or narrow the prop to `paused`-forever semantics with a comment.

**L8. Sidebar refetches six endpoints on every navigation**
`frontend/src/components/Sidebar.tsx:86-112`
Both heatmaps, both full worksheet lists, and **both full attempt lists** (writing attempts
include analysis + type + prompt) are refetched on every route change, only to count this
week's sessions and pick one pending worksheet. Fine for a local single user, but it's the
app's heaviest query pattern by far; a lightweight `/api/stats` (or reusing the heatmap
`attemptCount`s) would remove most of it. Also: demo attempts count toward the weekly momentum
ring.

**L9. Backend `tsc --noEmit` fails (TS6059)**
`backend/tsconfig.json`
The `include` covers `prisma/`, but `rootDir` is `src`, so `npx tsc --noEmit` errors on
`prisma/seed.ts`. Vitest doesn't surface it, so the workspace has no working typecheck command.
Either drop `rootDir` (it only matters for emit, which is disabled) or exclude `prisma`.

**L10. Math worksheet titles use slugs, and all-topics worksheets are hard to find**
`frontend/src/pages/Admin.tsx:134`
Saved titles read "Worksheet: fractions-decimals, probability" (slugs, not names). And a
worksheet generated with no topics selected stores `topicIds: []`, so it appears on no
single-topic page — only in Pending Worksheets and on the All Topics page, which is easy to
miss once it has an attempt (Pending drops it).

**L11. Frontend `GeneratedMathQuestion` type omits `stimulus`**
`frontend/src/lib/api.ts:148-155`, `frontend/src/pages/Admin.tsx:492-499`
The runtime data carries `stimulus` (Admin renders it via `(q as any).stimulus` casts), but the
type doesn't declare it. Add `stimulus?: StimulusSpec` and drop the casts — this is the same
class of drift the mirrored stimulus libs deliberately avoid.

**L12. Error middleware exposes raw internal messages, always as 500**
`backend/src/middleware/error.ts`
`err.message` (Prisma internals, file paths) is returned to the client verbatim with a blanket
500. Low stakes for a local app, but a generic message + server-side log would match the
polish elsewhere.

**L13. `MathQuestionCard` still falls back to placeholder options**
`frontend/src/components/MathQuestionCard.tsx:13-18`
On a JSON parse failure the card silently renders `['A','B','C','D','E']` — the C3 symptom kept
as a fallback. Corrupt options should render an explicit error, not fake answer choices a
student might select.

**L14. Small polish items (grouped)**
- `worksheets.ts:58` — `prompts[i] ?? prompts[0]` silently reuses prompt 0 when fewer prompts
  than types arrive; better to 400 on a count mismatch.
- `MathPracticeHome.tsx:80` — question count falls back to `|| 10` when a topic bank is empty,
  and "all 20 topic categories" is hardcoded in two places.
- `AttemptDetail.tsx:53` — the initial spinner says "Analysing your writing..." while it is
  actually loading the attempt.
- `demo.service.ts:68` — `const attempt =` is unused; demo data uses `Math.random()`, so
  loads are non-reproducible.
- `attempts.ts:11` — `timeTaken === undefined` passes `null` through to Prisma (500 instead
  of 400).
- `stimulus.ts` grid validation doesn't check `rowLabels`/`colLabels` lengths against
  `rows`/`cols` (short label arrays render blank headers).

---

## 3. Suggested priority

1. **H4** — worksheet writing feedback is currently graded against the wrong prompt; this
   undermines the worksheet loop the app is built around.
2. **H5** — one demo cycle can permanently pollute topic banks; cheap fix, destructive bug.
3. **M6** — parity with H1: never lose a student's test silently.
4. **M7–M10** — consistency and trust-boundary fixes, each small.
5. The L-series as convenient batches (L3+L4+L5 make a natural "error-handling parity" task).

All of the above go through the mandatory workflow: plan → approval → worklog items →
failing e2e first → fix → full suites → screenshots → manual sign-off.
