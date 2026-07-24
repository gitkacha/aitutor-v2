# Milestone 3 — Agentic Coach: skill analytics, admin chat, interventions, student coaching

**Status:** Approved design (brainstormed and approved section-by-section with the user, 2026-07-24).
**Depends on:** Milestone 2 (multi-user workspaces) — complete.

This spec is written to be implementable by less-capable coding models: every formula, schema,
threshold, and file path is stated exactly. Where the spec says "exactly", do not substitute
judgment — implement as written. Follow existing code patterns; each section names the existing
file to imitate.

## 0. Non-negotiables (from the user)

1. **Accuracy of diagnosis.** Every statistic shown to an admin is computed by deterministic
   SQL/TypeScript code, never by an AI model. The AI only narrates numbers it received from tools.
2. **Traceability.** For every intervention an admin must be able to see: what the student was
   struggling with at that time (frozen snapshot), what the AI recommended and why (verbatim),
   which worksheets/coaching were provided (links), and whether scores improved (recomputed live
   from raw attempts — never stored).
3. **Comprehensive skill list** derived from the NSW Selective test specification; user reviews
   and approves the taxonomy before it ships (M3a gate).
4. **Exam-level coaching.** Coaching content is pitched at NSW Selective level and admin-approved
   before any student sees it.
5. **No cohort over-reliance.** Primary baselines are the student's own history and exam-anchored
   absolutes. Cohort comparisons appear only when the cohort gate (§4.6) passes; otherwise they
   are omitted entirely (never shown as "n/a").
6. **Answer-key hygiene.** No new endpoint may return `correctIndex`/`explanation` to a student
   (same discipline as W-28..W-30).

## 1. Phase overview

Build in this order. Do not start a phase before the previous phase's success criteria are met.

- **M3a — Measurement foundation:** skill taxonomy, question tagging, per-question capture,
  analytics service.
- **M3b — Agentic admin chat + interventions:** chat with tools, confirmation gating,
  Improvement Journey UI.
- **M3c — Coaching:** coaching-module library, student lesson experience, review weaving.

## 2. Data model (Prisma) — all phases

Add to `backend/prisma/schema.prisma`. Field names are exact.

```prisma
// M3a ------------------------------------------------------------------------
model Skill {
  id             Int     @id @default(autoincrement())
  subject        String  // 'math' | 'writing'
  topicId        Int?    // FK to MathTopic for math skills; null for writing skills
  name           String
  slug           String  @unique
  description    String
  examLevelNotes String  // what NSW-Selective-level mastery of this skill looks like
  isDemo         Boolean @default(false)
  topic          MathTopic? @relation(fields: [topicId], references: [id])
  questions      MathQuestion[]
  coachingModules CoachingModule[]
}

// MathQuestion gains: skillId Int? + skill Skill? relation (nullable during backfill,
// non-null enforced by generation code for all new questions).

// MathAttempt gains three nullable String columns (JSON), all keyed by question id:
//   questionTimings   e.g. {"412": 45200, "413": 61000}  — dwell time in ms
//   questionFlags     e.g. [412, 419]                     — ids flagged during the test
//   answerChanges     e.g. {"412": 2}                     — times the choice was changed
// Attempts predating M3a keep these null; analytics must treat null as "no data".

// Analysis gains: criteriaScores String? — JSON {"vocabulary": 72, "sentence-variety": 60, ...}
// keyed by writing-skill slug, 0-100. Existing three score columns stay untouched.

// M3b ------------------------------------------------------------------------
model ChatSession {
  id          Int       @id @default(autoincrement())
  workspaceId Int
  adminId     Int
  title       String    // first user message, truncated to 80 chars
  createdAt   DateTime  @default(now())
  messages    ChatMessage[]
  interventions Intervention[]
}

model ChatMessage {
  id        Int      @id @default(autoincrement())
  sessionId Int
  role      String   // 'user' | 'assistant' | 'tool'
  content   String   // for role 'tool': JSON {toolName, args, result}
  createdAt DateTime @default(now())
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model Intervention {
  id                Int      @id @default(autoincrement())
  workspaceId       Int
  studentId         Int
  createdById       Int
  chatSessionId     Int?
  skillSlugs        String   // JSON array of skill slugs this intervention targets
  diagnosisSnapshot String   // JSON, exact shape in §6.2 — FROZEN, never updated
  recommendation    String   // AI's recommendation text, verbatim
  rationale         String   // AI's reasoning text, verbatim
  worksheetIds      String   // JSON {"math": [ids], "writing": [ids]}
  coachingModuleIds String   // JSON array of CoachingModule ids
  status            String   @default("active") // 'active' | 'closed'
  createdAt         DateTime @default(now())
  chatSession       ChatSession? @relation(fields: [chatSessionId], references: [id])
}
// NOTE: outcome is NOT a column. It is recomputed on every read (§6.3).

// M3c ------------------------------------------------------------------------
model CoachingModule {
  id           Int      @id @default(autoincrement())
  workspaceId  Int
  skillId      Int
  title        String
  content      String   // markdown, structure in §8.1
  status       String   @default("draft") // 'draft' | 'approved'
  reviewedById Int?
  version      Int      @default(1)
  createdAt    DateTime @default(now())
  skill        Skill    @relation(fields: [skillId], references: [id])
  assignments  CoachingAssignment[]
}

model CoachingAssignment {
  id             Int       @id @default(autoincrement())
  moduleId       Int
  studentId      Int
  interventionId Int?
  completedAt    DateTime?
  createdAt      DateTime  @default(now())
  module         CoachingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  @@unique([moduleId, studentId])
}
```

## 3. Skill taxonomy (M3a)

- Seed file: `backend/prisma/seed-skills.ts`, invoked from the existing seed entrypoint.
- **Math:** for each of the 20 existing `MathTopic`s, 3–7 skills derived from the NSW Selective
  Mathematical Reasoning specification. Include technique-level skills (e.g. under Arithmetic:
  `faster-long-division`, `mental-multiplication-strategies`). There is no Decimals topic —
  decimal skills live under their host topics, e.g. Arithmetic gets `decimal-operations` and
  `decimal-division`; Number Place Values gets `ordering-decimals` and `rounding-decimals`.
- **Writing:** exactly these 7 skills (subject `writing`, `topicId` null):
  `vocabulary`, `sentence-variety`, `ideas`, `text-structure`, `punctuation-grammar`,
  `audience`, `cohesion`.
- **Gate:** the full drafted taxonomy is presented to the user for review and approval before the
  seed is committed. A read-only "Skills" browser page for admins lists it grouped by topic.
- **Tagging new questions:** the math generation prompt requires a `skillSlug` per question chosen
  from the closed list for the selected topics; the existing verifier pass additionally validates
  the tag (question actually exercises that skill) and corrects it if wrong.
- **Backfill:** one-off script `backend/scripts/backfill-skill-tags.ts` tags every existing bank
  question via the analysis model against the closed list, verifier-checked, then sets `skillId`.
  Print a summary table for spot-checking. Questions the verifier can't settle get the topic's
  first skill and a logged warning.

## 4. Analytics service (M3a) — the accuracy core

File: `backend/src/services/analytics.service.ts`. **Zero AI calls in this file.** All functions
are pure given DB rows, unit-testable with synthetic fixtures.

Definitions used throughout:
- **Window:** the student's last `N` finished math attempts with `source` in
  (`'timed'`,`'worksheet'`,`'practice'`) — default `N = 10`; callers may pass `lastNTests`.
- **Evidence floor `E = 8`:** a skill with fewer than 8 attempted questions in the window is
  reported with `sufficientEvidence: false` and MUST NOT be called a weakness or strength.
- **Own median time `M`:** median per-question dwell over all the student's timed questions that
  have timing data. If no timing data exists, all time-based signals return `null`.
- **Exam anchor:** 2400 s / 35 questions ≈ **68.6 s** per question.

### 4.1 Per-skill accuracy
`correct / attempted` over the window, per skill (join answers → question → skillId).

### 4.2 Per-skill time
Mean dwell ms per skill (questions with timing only), reported alongside `M` and the exam anchor.
"Slow" label, exactly: mean > max(1.5 × M, 68 600 ms).

### 4.3 Fast-wrong / slow-wrong split
For each wrong answer with timing: **fast-wrong** if dwell < 0.6 × M; **slow-wrong** if
dwell > 1.5 × M; otherwise mid-wrong. Report counts per skill. Interpretation guidance (for the
chat prompt, not this file): fast-wrong → exam-technique coaching; slow-wrong → skill-gap coaching.

### 4.4 Misconception fingerprint
Per skill: the modal wrong option index and its share of that skill's wrong answers, plus that
option's text. Only reported when the skill has ≥ 4 wrong answers and the modal share ≥ 0.5.

### 4.5 Pacing curve
Split each attempt's question list into thirds by position (first ⌈n/3⌉, etc.). Report accuracy
and unanswered-rate per third, aggregated over the window. Unanswered = answer index is null/-1.

### 4.6 Cohort baseline (gated)
Per skill: mean accuracy across workspace students having ≥ E questions on that skill. Include
ONLY if ≥ 5 such students exist; otherwise omit the field entirely from the report.

### 4.7 Trend and stability
Per skill: split the window's attempts into older half and newer half by `finishedAt`; trend =
newer accuracy − older accuracy (report as percentage points; require ≥ 4 questions per half,
else `null`). Stability = population standard deviation of per-attempt skill accuracy across
attempts that contain ≥ 2 questions of the skill.

### 4.8 Flag and answer-change signals
Per skill: flagged-and-wrong count, flagged-and-right count ("fragile confidence"); answer
changes per question, and of changed answers the fraction where the final answer was correct
(feeds "first instinct" technique coaching). Null-safe for pre-M3a attempts.

### 4.9 Writing signals
Per writing skill: mean `criteriaScores` value over the window (last N writing attempts,
default 10) and trend (same halves method). Also time-used ÷ time-limit and word count trends.
Analyses predating `criteriaScores` contribute only to the legacy overall trends.

### 4.10 Report shape
`getStudentSkillReport(studentId, subject, lastNTests?)` returns
`{ window: {…}, skills: SkillSignal[] }` where every `SkillSignal` carries
`{ slug, name, attempted, correct, accuracy, sufficientEvidence, meanTimeMs, fastWrong,
slowWrong, misconception?, trendPts, stabilitySd, flaggedWrong, flaggedRight,
answerChangeHelpRate, cohortAccuracy? }` — numeric fields `null` when uncomputable.
`getOpportunityAreas(subject, studentId?)` ranks: with `studentId`, that student's
sufficient-evidence skills ascending by accuracy (ties: worse trend first); without, the cohort
gate applies per skill and ranking is by cohort accuracy.

### 4.11 Capture instrumentation (frontend)
In `MathTimedPractice`: accumulate dwell per question id on every navigation (and on submit for
the final question), count answer changes per question, and include existing flags; submit all
three JSON fields with the attempt POST. The attempt endpoint stores them verbatim.

## 5. Chat agent (M3b)

### 5.1 AI role
Fourth configurable role, same pattern as the existing three in the AI service config:
`CHAT_MODEL` / `CHAT_BASE_URL` / `CHAT_API_KEY` / `CHAT_TOKENS_PARAM`. Default model:
`gpt-5-mini`. All calls logged via the existing `[ai-usage]` logger with role `chat`.

### 5.2 API
All admin-only (`requireAdmin`), workspace-scoped. Router `backend/src/routes/chat.ts`:
- `POST /api/chat/sessions` → create session `{ id }`.
- `GET /api/chat/sessions` / `GET /api/chat/sessions/:id` → list / full transcript.
- `POST /api/chat/sessions/:id/messages` `{ content }` → runs the tool loop (§5.4), persists all
  messages, returns `{ messages: ChatMessage[], suggestedQuestions: string[], pendingAction? }`.
- `POST /api/chat/sessions/:id/confirm` `{ actionId, approve }` → executes or discards a pending
  action (§5.5).

### 5.3 Tools
Service `backend/src/services/chat-tools.ts` exports the tool schemas + a
`dispatchTool(name, args, ctx)` function (`ctx` = `{ workspaceId, adminId }`). **Read tools**
(auto-executed): `list_students`, `get_student_skill_report`, `get_opportunity_areas`,
`get_attempt_details`, `get_intervention_history`, `get_coaching_modules`. Read tools call the
analytics service / Prisma directly — they are thin adapters, no logic of their own.
**Action tools** (never auto-executed — §5.5): `generate_worksheet` (subject, topic slugs and/or
skill slugs, questionCount 5–50 — same freedom as the manual flow; skill-targeted generation
passes the skill list into the existing generation prompt), `save_and_assign_worksheet`,
`assign_coaching`, `create_intervention`.

### 5.4 Tool loop
In `backend/src/services/chat.service.ts`: standard OpenAI function-calling loop — send system
prompt + transcript + tool schemas; while the model returns tool calls (max 8 iterations per
user message): read tools → execute, append result, continue; action tool → stop the loop and
return it as `pendingAction`. System prompt requirements (store as a template in the service):
never state a number absent from tool output; when the admin names a student, call
`get_student_skill_report` first and populate `suggestedQuestions` (3–5, each grounded in an
actual anomaly in the report); respect `sufficientEvidence: false` (say "not enough data yet",
never guess); when composing an intervention worksheet, ensure ≥ 8 questions per targeted skill
and say so.

### 5.5 Confirmation gating (trust mechanic)
An action tool call is persisted as a `pendingAction` (in-memory map keyed by uuid, like the
existing generation-jobs pattern) and rendered in the UI as a confirmation card showing the exact
arguments (worksheet composition, assignee, intervention text). Nothing mutates until the admin
clicks Confirm, which hits `/confirm`; the result is fed back into the loop as the tool result so
the conversation continues naturally. Deny feeds back "the admin declined".

### 5.6 Chat UI
`frontend/src/pages/CoachChat.tsx`, admin sidebar entry "Coach Chat". Transcript view where:
tool results of the analytics tools render as **data cards** (compact tables: skill, accuracy,
n, time, trend) inline above the assistant's prose; `suggestedQuestions` render as clickable
chips that send that text; `pendingAction` renders as the confirmation card. Plain
request/response (no streaming) in v1. Follow the app's look-and-feel rules (no gradients etc.).

## 6. Interventions and the Improvement Journey (M3b)

### 6.1 Creation
Only via the `create_intervention` action tool + admin confirmation. The tool handler recomputes
the skill report at that instant and freezes the targeted skills' `SkillSignal`s into
`diagnosisSnapshot` — the snapshot is server-computed, never model-supplied.

### 6.2 `diagnosisSnapshot` JSON shape (exact)
```json
{ "capturedAt": "ISO", "windowTests": 10,
  "skills": [ { …one SkillSignal as in §4.10… } ] }
```

### 6.3 Outcome recomputation (never stored)
`getInterventionOutcome(interventionId)`: for each targeted skill, recompute the same signals
over attempts with `finishedAt > intervention.createdAt`. Status per skill, exactly:
- `insufficient-evidence` if post-attempted < 8;
- `improving` if post-accuracy ≥ snapshot accuracy + 10 percentage points;
- `not-yet-improving` otherwise.
Intervention-level status = worst of its skills' statuses (order: insufficient < not-yet <
improving is NOT the order — worst means: any `not-yet-improving` → that; else any
`insufficient-evidence` → that; else `improving`).

### 6.4 UI
On the admin's student view (`frontend/src/pages/AdminStudent.tsx` area): an **Improvement
Journey** section — reverse-chronological intervention cards, each showing the frozen diagnosis,
recommendation + rationale verbatim, a "View conversation" link to the chat session, artifact
links (worksheets reuse `MathWorksheetContent`; coaching modules link to their page with
completion state), and the live outcome panel with per-skill before → after and the status
label. Above the timeline: a Recharts line chart of accuracy-over-time for a selected skill with
vertical reference lines at intervention dates. Admin dashboard gets an **Active Interventions**
strip (student, skills, age, status). The topic heatmap becomes drillable: clicking a topic card
reveals its skills as sub-cards using the same colour scale.

## 7. Endpoints summary (M3b)
`GET /api/analytics/students/:id/report?subject=&lastNTests=` (admin), `GET
/api/analytics/opportunity-areas`, `GET/POST /api/interventions` + `GET
/api/interventions/:id/outcome` (admin; creation only via chat confirm), chat routes (§5.2).
Student-facing endpoints in M3c must never include math answer keys.

## 8. Coaching (M3c)

### 8.1 Module content structure (markdown sections, exact order)
`## The idea` (concept recap at exam level) → `## Step by step` (numbered procedure) →
`## Speed technique` (omit section if none applies) → `## Worked examples` (2–3) →
`## Traps to avoid` (fed with the skill's misconception fingerprints where available).

### 8.2 Lifecycle
Admin triggers generation from the Skills browser or via chat (`get_coaching_modules` reveals
gaps; generation itself is an admin UI action or an action tool — implement as part of
`assign_coaching`: if no approved module exists for the skill, the confirmation card offers
"generate draft first"). Generation uses the generation role anchored on `examLevelNotes`;
the verifier role checks each worked example's arithmetic. Admin reviews the draft in a module
editor page (markdown preview, Approve button → `status: 'approved'`, `reviewedById`,
`version++` on later edits). Only approved modules are assignable or visible to students.

### 8.3 Student experience
- Pending list: assigned lessons appear as "Learn: <title>" cards ordered before their paired
  worksheet ("Practise" card shows a "best after the lesson" hint when its intervention has an
  incomplete lesson). Soft ordering only — never hard-lock the worksheet.
- Lesson page `frontend/src/pages/Lesson.tsx`: rendered markdown, calm layout, "Mark as
  complete" → `completedAt`.
- Post-test review: each question shows its skill chip; wrong answers whose skill has an
  approved module show a "Learn the method →" link.
- Writing modules: identical pipeline keyed to the 7 writing skills.

## 9. Testing strategy (per the mandatory workflow, RED-first)

- **Analytics unit tests (the accuracy proof):** `backend/src/services/analytics.service.test.ts`
  with synthetic fixture attempts and hand-computed expected outputs for every signal in §4,
  including: evidence-floor boundaries (7 vs 8 questions), null timing data, fast/slow-wrong
  thresholds at exactly 0.6×/1.5× M, cohort gate at 4 vs 5 students, trend with odd attempt
  counts, misconception share at exactly 0.5.
- **Chat e2e:** extend the existing OpenAI stub (port 3106) to script tool-calling responses
  (stub returns canned `tool_calls` for known prompts). e2e specs prove: report data card
  rendering, suggested chips, confirmation gating (action executes only after Confirm; Deny
  executes nothing), intervention snapshot freezing, outcome recomputation after a scripted
  post-intervention attempt.
- **Capture e2e:** a timed test drives navigation and asserts the stored
  `questionTimings`/`questionFlags`/`answerChanges` on the created attempt.
- **Coaching e2e:** draft → approve → assign → student sees lesson before worksheet → complete →
  review-screen "Learn the method" link.
- Full `npm run e2e` + `npm test` + `npm run typecheck` before every commit; live screenshot
  review for every new screen.

## 10. Success criteria

**M3a:** taxonomy seeded and user-approved; every bank question tagged; a timed test stores all
three capture fields; `getStudentSkillReport` matches hand-computed fixtures; Skills browser
renders.
**M3b:** admin asks "how is <student> doing in maths?" → grounded chips + data cards; accepting
a suggestion produces an intervention whose snapshot matches the report at that moment; a chat-
generated multi-area worksheet flows through the existing review/save/assign pipeline; the
Improvement Journey shows before → intervention → after with recomputed status; no number in
chat prose is absent from its tool-result cards (spot-check).
**M3c:** approved-only visibility enforced; learn → practise ordering visible to the student;
review weaving works; a full loop (diagnose → intervene → lesson + worksheet → improvement
visible) demonstrated end-to-end on seeded data.

## 11. Guidance for implementing agents — cost vs accuracy rules

Cheaper coding models may be used ONLY where correctness is enforced by pre-specified tests,
never where it depends on the model's judgment. Exactly:

- **Accuracy-critical, pre-specified tests required:** the analytics service (§4), snapshot
  freezing and outcome recomputation (§6.1–6.3). The implementation plan must include the unit-
  test fixtures and their hand-computed expected values *verbatim in the plan* (authored and
  reviewed at planning time, not by the implementing model). The implementing model transcribes
  the tests first (RED), then implements until GREEN. A model must never author both the formula
  and the expected values it is checked against.
- **Do not delegate to a weaker model at all:** the skill taxonomy content (§3), the chat system
  prompt (§5.4), coaching-module content generation prompts (§8.2), and any change to the
  verifier integration. These are judgment work.
- **Safe for cheaper models with the tests in hand:** routes, UI components, Prisma plumbing,
  e2e specs whose scenarios are spelled out in the plan — all verified by the mandatory full
  `npm run e2e` + `npm test` + `npm run typecheck` gates, which apply identically regardless of
  which model wrote the code.

General rules:

- Work in the smallest possible units; each numbered section above is independently testable.
- Imitate existing patterns: routes copy `math-worksheets.ts` structure; jobs copy
  `generation-jobs.ts`; AI role config copies the existing three-role pattern; UI copies
  existing admin pages. When unsure, find the analogous existing code and match it.
- Never put statistics logic anywhere except `analytics.service.ts`.
- Every new student-reachable response must be checked against the answer-key rule (§0.6).
- The mandatory 5-step workflow in `CLAUDE.md` applies to every work item in this milestone.
