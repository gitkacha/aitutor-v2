# Project Review — NSW Selective Prep Coach

**Reviewed:** 2026-07-16, at commit `6783827` plus uncommitted changes to `CLAUDE.md` and `frontend/src/components/Sidebar.tsx`.
**Scope:** full read-through of backend and frontend source, schema, seed/demo services, tests, and project docs.

> **Update (2026-07-16):** All four critical findings (C1–C4) are **fixed**. Each was first
> reproduced by a failing Playwright e2e test, then fixed, then proven green — see
> `e2e/c1-math-timer.spec.ts`, `e2e/c2-c3-worksheet.spec.ts`, and `e2e/c4-analysis.spec.ts`
> (`npm run e2e`; the suite runs on an isolated database and its own ports). C4 was additionally
> verified with a live gpt-4o-mini call through the app's own API. Fixing C4 also uncovered and
> fixed a latent bug: the backend never loaded `.env` into `process.env` (only Prisma's
> `DATABASE_URL` worked), so the AI key was never picked up at all — `dotenv` is now loaded at
> startup. The C2 fix persists worksheet questions as real `MathQuestion` rows
> (migration `math_worksheet_question_rows`), which also resolves C3 and removes the client-side
> scoring fork; legacy worksheets are backfilled lazily on first use. The High/Medium/L/T findings
> below remain open.

---

## 1. Project Summary

NSW Selective Prep Coach is a local-only practice and progress-tracking web app for the NSW
Selective High School Placement Test, covering two subjects:

- **Writing** — 11 text types with 55 seeded prompts. The student writes under a realistic
  30-minute countdown in a distraction-free editor (spellcheck disabled), and every attempt is
  sent for AI analysis producing scores and comments on vocabulary, sentence structure, and
  content.
- **Mathematics** — 20 topic categories with a seeded 35-question bank (including shared-stimulus
  question groups). Practice is single-topic or a mixed "All Topics" test, 5-option multiple
  choice, timed at ~69 seconds per question (max 40 minutes), with auto-scoring, per-topic
  breakdown, and a full answer review with explanations.

Progress is shown as red-to-green heatmaps (one per subject) with per-type/topic drill-down into
score history (Recharts line chart). An **Admin** view turns the heatmaps into AI-generated
worksheets — a single targeted writing prompt, or a 35-question math worksheet calibrated against
the hardest seeded reference questions — with a review step before saving. Worksheet attempts
feed back into the same heatmaps. Demo data can be loaded and cleared without touching real work
(every model carries an `isDemo` flag).

**Architecture:** npm workspaces monorepo. Backend is Express 4 + Prisma 5 + SQLite with an
isolated AI service layer (currently OpenRouter); frontend is Vite + React 18 + TypeScript +
Tailwind + Recharts. One `npm run dev` starts both; the frontend proxies `/api` to port 3001.
The structure is clean and conventional: thin route files, a small typed API client, page/component
separation, and an idempotent seed (upsert + prompt replace).

**What's done well**

- Sensible, readable schema; `isDemo` flags throughout make demo load/clear safe.
- AI calls are genuinely isolated behind `ai.service.ts` — the rest of the app doesn't care.
- Worksheet generation has a proper admin review step before saving.
- The exam screens are calm and uncluttered; `beforeunload` guards, a `submittedRef` double-submit
  guard, and auto-submit on expiry are all present.
- Seed is idempotent; `postinstall` gives a true one-command start.

---

## 2. Review Findings

### Critical

**C1. Math timed practice auto-submits immediately on load**
`frontend/src/pages/MathTimedPractice.tsx:55-56`

```ts
const totalTime = Math.min(questions.length * 69, 2400);
const [timeLeft, setTimeLeft] = useState(totalTime);
```

`timeLeft` is initialised on the first render, while `questions` is still `[]`, so it starts at
**0** and is never re-synced when the questions arrive. Once loading finishes, the `Timer` mounts
with `timeLeft=0` and `running=true`, and its effect (`Timer.tsx:29-34`) fires `onTimeUp()`
immediately — submitting the attempt with every answer `-1` before the student sees a question.
This affects every math practice path (single topic, All Topics, and worksheets).
**Fix:** reset the clock when questions load, e.g. `useEffect(() => setTimeLeft(totalTime), [totalTime])`
guarded to run once, or don't render/start the timer until `totalTime > 0`.

**C2. Math worksheet attempts are scored against the wrong questions**
`frontend/src/pages/MathTimedPractice.tsx:83-92` → `backend/src/routes/math-attempts.ts:15-42`

The worksheet flow computes score/breakdown client-side but never sends them. It submits array
indices as question IDs (`questions: JSON.stringify(wq.map((_, i) => i))` — i.e. `[0,1,...,34]`),
and the backend then re-derives score and topic breakdown by looking those "IDs" up in
`MathQuestion` — matching **unrelated seeded questions** with ids 1–34. Consequences:

- the stored score and per-topic breakdown are wrong (they compare the student's answers to
  the seed bank's `correctIndex`, not the worksheet's);
- the heatmap is polluted with wrong per-topic data;
- the review page (`math-attempts.ts:103-110`) fetches and displays those seeded questions
  instead of the worksheet questions the student actually answered.

**Fix:** persist generated worksheet questions as real `MathQuestion` rows (flagged, e.g.
`source: 'worksheet'`) at save time, so attempts, scoring, and review all use the normal
ID-based path. That removes the client-side scoring fork entirely.

**C3. Worksheet questions render placeholder options instead of real ones**
`frontend/src/components/MathQuestionCard.tsx:13-18`

The card does `JSON.parse(question.options)`. DB questions store `options` as a JSON string, but
worksheet questions (passed via router state from `MathPracticeHome.tsx:63-69`) carry `options`
as a `string[]`. `JSON.parse` on an array throws, and the catch substitutes the literal
placeholders `['A','B','C','D','E']` — so a student taking a worksheet sees letter labels with no
actual answer choices. Fix follows from C2 (single data shape), or make the card accept
`string | string[]`.

**C4. AI model/provider is broken and now contradicts CLAUDE.md**
`backend/src/services/ai.service.ts:3-4`

- The uncommitted `CLAUDE.md` change specifies the **OpenAI API with `gpt-4o-mini`**; the code
  still calls **OpenRouter** with model `openrouter/free`.
- `openrouter/free` is not a valid OpenRouter model ID (free variants look like
  `vendor/model:free`), so every call likely returns a 400 and silently falls back.
- The fallback analysis (`getFallbackAnalysis`, score 0 across the board) is then **persisted** as
  a real `Analysis` row and cached forever (`analysis.ts:12-16` returns the existing row and never
  retries), so one bad call permanently records a 0 and drags the heatmap average down.

**Fix:** migrate the service to OpenAI `gpt-4o-mini` per CLAUDE.md; return an error (or a
non-persisted result) instead of writing failure rows; add a way to re-run analysis.

### High

**H1. Auto-submit with an empty writing attempt fails and strands the student**
`frontend/src/pages/TimedPractice.tsx:32-50`, `backend/src/routes/attempts.ts:9`

The backend validation uses falsy checks (`!text`), so when the 30 minutes expire with an empty
textarea the POST returns 400, the catch resets state, and the student sits at 0:00 with nothing
happening (the timer effect won't re-fire). Also `promptId: prompt?.id || 0` masks a missing
prompt as id 0. Validate `text === undefined` (empty string is a legitimate timed-out attempt) or
handle the failure visibly.

**H2. Async route errors bypass the error middleware**
e.g. `backend/src/routes/math-attempts.ts:15-16`, `attempts.ts`, `heatmap.ts`

Express 4 does not catch rejected promises from async handlers. `JSON.parse` of client-supplied
`questions`/`answers` (malformed body → throw), or any Prisma error in the routes without
try/catch, becomes an unhandled rejection and the request hangs; `middleware/error.ts` never runs.
Wrap handlers (tiny `asyncHandler` helper) or upgrade to Express 5, and parse client JSON
defensively.

**H3. Multi-type writing worksheets silently drop all but the first type**
`backend/src/routes/worksheets.ts:47` (`typeId: typeIds[0]`)

The admin UI allows selecting several text types and the generator receives them all, but the
saved `Worksheet` keeps only the first `typeId`. `GET /api/worksheets/available/:typeId` will
therefore never surface the worksheet for the other selected types. Store the full list (as the
math side does with `topicIds`) or restrict the UI to one type.

### Medium

**M1. 35 questions in one LLM call, with no output validation**
`backend/src/services/ai.service.ts:229-310`

One completion is asked for 35 detailed MCQs (`max_tokens: 8000`) — truncation mid-array is
likely, in which case the regex-extract-then-parse fails and the admin silently receives the
fallback: **35 identical "What is 25 × 4?" placeholders**, which can be saved as a real
worksheet. Also: the parsed JSON is never validated (5 options, `correctIndex` 0–4, `topicSlug`
must be one of the requested topics), and the prompt's JSON example hardcodes
`topics[0]?.slug` — models tend to echo it, tagging every question with the first topic and
skewing the breakdown/heatmap. Generate in batches (e.g. 5–7 per topic), validate each item
with a schema, and make the fallback unmistakably an error state rather than plausible-looking data.

**M2. "All Topics" test isn't capped at 35 questions**
`backend/src/routes/math-questions.ts:22-28`

The no-topic branch returns the *entire* question bank shuffled. That's coincidentally 35 today,
but the first bank expansion silently turns the "35-question test" into a longer one. Add
`.slice(0, 35)` (topic-balanced ideally). The Fisher-Yates shuffle also splits stimulus groups, so
shared-stimulus questions appear scattered and the stimulus re-renders per question — consider
keeping group members adjacent.

**M3. Unknown topic filter returns everything**
`backend/src/routes/math-attempts.ts:67-75`

`GET /api/math/attempts?topic=<bad-slug>` drops the filter when the topic isn't found and returns
all attempts. Return 404 or an empty list.

**M4. Analyses are write-once with no retry path**
`backend/src/routes/analysis.ts:12-16`

Combined with C4, a failed analysis (score 0) is returned forever. Support `?force=true` or delete-
and-retry from the attempt detail page.

**M5. Heatmap error/loading states are conflated**
`frontend/src/components/Heatmap.tsx:28-34` shows "Loading heatmap data..." forever when the fetch
failed (errors are swallowed with `.catch(() => {})` throughout Admin/Sidebar). Distinguish
loading from error, at least with a retry hint.

### Look & feel / CLAUDE.md compliance

**L1. Sidebar violates the banned-elements list (uncommitted change)**
`frontend/src/components/Sidebar.tsx:35` uses `bg-gradient-to-b from-blue-50 to-blue-100` —
CLAUDE.md explicitly bans background gradients (the previous commit's teal gradient had the same
problem). There's also a stray `border-teal-400` at line 148, and the whole file uses Tailwind
default `blue-*` shades instead of the brand `#1c6dd0` tokens used elsewhere (`brand-blue`).
Recommend a flat white/gray sidebar with brand-blue accents before committing.

**L2. Hand-rolled timer and heatmap**
CLAUDE.md says to prefer mature libraries for "the heatmap and charts, and the countdown timer."
Both are custom (`Timer.tsx`, `Heatmap.tsx`). The implementations are small and mostly fine — the
grid "heatmap" is arguably better than a library here — but the timer bug (C1) is exactly the kind
of thing a library (e.g. `react-countdown`, or a `useCountdown` hook driven by timestamps instead
of tick-decrements) would have avoided. Note: tick-based counting also drifts and pauses in
background tabs; deriving remaining time from `Date.now() - startTime` is more exam-accurate.

### Testing

**T1. Test coverage does not support the "E2E verified" claims**
The backend suite only asserts that seed data exists; the frontend suite is a placeholder
(`expect(1 + 1).toBe(2)`) still marked "will be added in Phase 2". The README marks all 12 phases
complete with E2E validation, yet C1 means starting any math test instantly submits it — which a
single smoke test would have caught. Priorities: a supertest-based route test for
`POST /api/math/attempts` (correct/incorrect/worksheet cases), a render test for
`MathTimedPractice` asserting the timer starts at the expected value, and a scoring unit test.

### Minor

- `package.json` `postinstall` runs `prisma migrate dev --name init` — a dev-only command in an
  install hook; `prisma migrate deploy` (or `db push` for this use case) is the right tool.
- README "Copy the `.env` file" should read "Create a `.env` file"; also the README tech-stack
  table still says OpenRouter and will need updating with the OpenAI migration (C4).
- `getFallbackPrompts()` returns 1 prompt but the no-API-key branch of
  `generateWorksheetPrompts` returns 3 (`ai.service.ts:154-160`), contradicting the
  single-prompt worksheet design.
- `fetchJSON` sends `Content-Type: application/json` on GETs (harmless, but easy to scope to
  bodied requests).
- Math heatmap re-parses every attempt's `topicBreakdown` once per topic — O(topics × attempts)
  JSON.parse (`math-heatmap.ts:17-23`). Parse once, then aggregate. Irrelevant at local scale,
  trivial to fix.

---

## 3. Recommended fix order

1. **C1** (timer) — one-line class of fix; math practice is unusable until then.
2. **C2 + C3** (worksheet persistence/scoring/options) — persist generated questions as
   `MathQuestion` rows and delete the client-side scoring fork.
3. **C4 + M4** (OpenAI migration, stop persisting failed analyses, allow re-run).
4. **H1, H2** (empty-text submit, async error handling).
5. **H3, M1–M3, L1** as a cleanup pass.
6. **T1** — add the three tests above so regressions in 1–4 stay caught.
