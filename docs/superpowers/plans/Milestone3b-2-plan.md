# Milestone 3b-2 — Coach Chat + Improvement Journey UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin-facing UI for the agentic coach — a Coach Chat page (transcript with analytics
data cards, suggested-question chips, confirmation cards) and an Improvement Journey on the admin
student view (intervention timeline, per-skill accuracy chart with intervention markers, Active
Interventions strip, heatmap drill-to-skills) — all built on the M3b-1 chat/interventions API.

**Architecture:** A thin API client (`chatApi`/`interventionsApi`) over the existing `fetchJSON`.
A pure `ChatTranscript` renderer turns persisted `ChatMessage[]` into bubbles/data cards (unit-
tested with fixtures). The Coach Chat page wires send/confirm/chips. The Improvement Journey lands
in `Admin.tsx`'s per-student view. One small analytics endpoint supplies the per-skill time series
the chart needs (the only backend work here).

**Tech Stack:** Existing only — Vite/React/TS/Tailwind frontend, Recharts (already used in
`ScoreHistory.tsx`), Express/Prisma backend, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-24-milestone3-agentic-coach-design.md` §5.6, §6.4.

## Global Constraints

- CLAUDE.md mandatory 5-step workflow per task; worklog items W-51…W-56 map to Tasks 1–6, ticked
  only after user sign-off.
- RED first; full `npm run e2e` + `npm test` + `npm run typecheck` green before every commit.
- e2e only against the isolated stack; a Coach-Chat UI e2e that needs the agent starts a per-spec
  OpenAI stub on 3106 scripting tool-calls (pattern: `e2e/m3b-chat.spec.ts`, `e2e/helpers/chat-stub.ts`).
- **Look-and-feel (CLAUDE.md):** brand palette `#1c6dd0`/`#2e9e5b`/`#f2a71b` + grays; NO background
  gradients, NO purple, NO gradient buttons, NO single-accent-border cards. Match existing
  `Admin.tsx`/`Skills.tsx`/`ScoreHistory.tsx` idioms. Every new screen gets a live screenshot check.
- **Accuracy display:** the UI only renders numbers the API returns; it never computes a statistic.
  Data cards show the tool result verbatim; outcome before→after comes from `GET /interventions`.
- Coach Chat and Improvement Journey are **admin-only** — route-guard with the existing
  `RequireAdmin` (`frontend/src/App.tsx:28`); sidebar entry gated by `user?.role === 'admin'`.
- **Transcript rendering rules** (from the M3b-1 shape): a `ChatMessage.role === 'tool'` content is
  JSON `{toolName, args, result, toolCallId}` → render as a data card (or hide non-analytics tools);
  an `assistant` message whose content parses to `{__assistantToolCalls:[…]}` is plumbing → HIDE it;
  a plain `assistant` message → assistant bubble; `user` messages whose content starts with
  `(system)` are action-outcome context turns → render as a subtle status line, not a user bubble.

## File structure

- `frontend/src/lib/api.ts` — add `chatApi`, `interventionsApi`, and their types.
- `frontend/src/components/ChatTranscript.tsx` — pure renderer of `ChatMessage[]`.
- `frontend/src/components/SkillReportCard.tsx` — renders a `get_student_skill_report` tool result.
- `frontend/src/pages/CoachChat.tsx` — the chat page (+ route in `App.tsx`, link in `Sidebar.tsx`).
- `frontend/src/components/ImprovementJourney.tsx` — intervention timeline + outcome (in `Admin.tsx`).
- `frontend/src/components/SkillTrendChart.tsx` — Recharts line + intervention ReferenceLines.
- Backend: `analytics-core.ts` + `analytics.service.ts` + `routes/analytics.ts` — per-skill trend.

---

### Task 1: API client — chatApi + interventionsApi

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Test: `frontend/src/lib/api.test.ts` (or extend an existing frontend test; vitest via `npm test -w frontend`)

**Interfaces:**
- Produces (exact types + calls):
```ts
export interface ChatMessage { id: number; sessionId: number; role: 'user' | 'assistant' | 'tool'; content: string; createdAt: string }
export interface PendingAction { id: string; toolName: string; args: any }
export interface ChatStepResult { messages: ChatMessage[]; suggestedQuestions: string[]; pendingAction?: PendingAction }
export interface ChatSessionSummary { id: number; title: string; createdAt: string }
export interface PerSkillOutcome { slug: string; before: number; postAttempted: number; postAccuracy: number; status: 'insufficient-evidence' | 'improving' | 'not-yet-improving' }
export interface InterventionWithOutcome { id: number; studentId: number; createdById: number; chatSessionId: number | null; skillSlugs: string; diagnosisSnapshot: string; recommendation: string; rationale: string; worksheetIds: string; coachingModuleIds: string; status: string; createdAt: string; outcome: { perSkill: PerSkillOutcome[]; status: string } }
export interface ActiveIntervention { id: number; studentId: number; studentName: string; skillSlugs: string; createdAt: string; status: string }
export const chatApi = {
  createSession: () => fetchJSON<{ id: number }>('/chat/sessions', { method: 'POST', body: '{}' }),
  listSessions: () => fetchJSON<ChatSessionSummary[]>('/chat/sessions'),
  getSession: (id: number) => fetchJSON<{ id: number; title: string; messages: ChatMessage[] }>(`/chat/sessions/${id}`),
  sendMessage: (id: number, content: string) => fetchJSON<ChatStepResult>(`/chat/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
  confirm: (id: number, actionId: string, approve: boolean) => fetchJSON<ChatStepResult>(`/chat/sessions/${id}/confirm`, { method: 'POST', body: JSON.stringify({ actionId, approve }) }),
};
export const interventionsApi = {
  list: (studentId: number) => fetchJSON<InterventionWithOutcome[]>(`/interventions?studentId=${studentId}`),
  listActive: () => fetchJSON<ActiveIntervention[]>('/interventions/active'), // workspace-wide (Task 6 endpoint)
  outcome: (id: number) => fetchJSON<{ perSkill: PerSkillOutcome[]; status: string }>(`/interventions/${id}/outcome`),
};
```

- [ ] **Step 1 (RED):** frontend unit test asserting `chatApi`/`interventionsApi` build the right
  URLs+methods+bodies. Mock `fetch` (as other frontend lib tests do — check `frontend/src/lib/` for
  the existing mock pattern; if none, `vi.stubGlobal('fetch', vi.fn(...))` returning `{ok:true,
  json:async()=>({})}` and assert the call args). Assert `sendMessage(3,'hi')` calls
  `.../chat/sessions/3/messages` with `POST` and body `{"content":"hi"}`; `confirm(3,'a',true)` →
  `.../confirm` body `{"actionId":"a","approve":true}`; `interventionsApi.list(2)` →
  `/interventions?studentId=2`.
- [ ] **Step 2: verify RED** (`npm test -w frontend`). **Step 3: implement** the two exports + types.
- [ ] **Step 4: GREEN** + `npm run typecheck`. **Step 5: Commit.**
  `git commit -m "feat(m3b2): chat + interventions API client"`

---

### Task 2: Per-skill accuracy trend endpoint (the chart's data)

**Files:**
- Modify: `backend/src/services/analytics-core.ts`, `backend/src/services/analytics.service.ts`,
  `backend/src/routes/analytics.ts`
- Test: append to `backend/src/services/analytics-core.test.ts`; `e2e/m3b2-skill-trend.spec.ts`

**Interfaces:**
- Produces:
```ts
// analytics-core.ts — one point per attempt that contains >=1 question of the skill
export interface SkillTrendPoint { attemptId: number; finishedAt: string; attempted: number; correct: number; accuracy: number }
export function computeSkillTrendSeries(records: AnswerRecord[], slug: string): SkillTrendPoint[]; // ascending by finishedAt then attemptId
// analytics.service.ts
export async function getSkillTrend(studentId: number, subject: 'math', slug: string): Promise<SkillTrendPoint[]>;
// route: GET /api/analytics/students/:id/skills/:slug/trend?subject=math  (requireAdmin + canAccessUser)
```

- [ ] **Step 1 (RED): transcribe exactly:**

```ts
import { computeSkillTrendSeries } from './analytics-core';
describe('computeSkillTrendSeries', () => {
  const r = (attemptId: number, day: number, correct: boolean, slug = 's1') =>
    rec({ attemptId, finishedAt: `2026-07-0${day}T00:00:00.000Z`, skillSlug: slug, correct });
  it('one point per attempt containing the skill, ascending, with accuracy', () => {
    const recs = [
      r(1, 1, true), r(1, 1, false),            // attempt 1: s1 1/2 = 0.5
      r(2, 2, true), r(2, 2, true),             // attempt 2: s1 2/2 = 1.0
      rec({ attemptId: 3, finishedAt: '2026-07-03T00:00:00.000Z', skillSlug: 's2', correct: true }), // other skill
    ];
    const series = computeSkillTrendSeries(recs, 's1');
    expect(series.map((p) => p.attemptId)).toEqual([1, 2]);
    expect(series[0].accuracy).toBeCloseTo(0.5, 6);
    expect(series[0].attempted).toBe(2);
    expect(series[1].accuracy).toBeCloseTo(1, 6);
  });
  it('empty when the skill never appears', () => expect(computeSkillTrendSeries([], 's1')).toEqual([]));
});
```

- [ ] **Step 2: verify RED. Step 3: implement** `computeSkillTrendSeries` (group the slug's records
  by attemptId, per group accuracy=correct/attempted, sort by finishedAt then attemptId). In
  `analytics.service.ts` add `getSkillTrend` reusing the shared `buildMathRecords` builder (as
  `getSkillSignalsSince` does — no duplicated mapping) filtered to the student's math attempts. Add
  the route (requireAdmin + canAccessUser → 404 out of workspace).
- [ ] **Step 4:** `e2e/m3b2-skill-trend.spec.ts` (admin): tag a question + submit two attempts on
  it (answer key via admin request, W-28 pattern — mirror `e2e/m3b-interventions.spec.ts`'s setup);
  `GET /api/analytics/students/:id/skills/:slug/trend?subject=math` → assert 2 ascending points with
  the expected accuracies; student-context → 403. RED→GREEN.
- [ ] **Step 5: full suites + typecheck. Step 6: Commit.**
  `git commit -m "feat(m3b2): per-skill accuracy trend endpoint"`

---

### Task 3: ChatTranscript + SkillReportCard (pure renderers)

**Files:**
- Create: `frontend/src/components/ChatTranscript.tsx`, `frontend/src/components/SkillReportCard.tsx`
- Test: `frontend/src/components/ChatTranscript.test.tsx` (vitest + @testing-library/react — check an
  existing component test for the render/query pattern; if none exist, render to string via
  `renderToStaticMarkup` and assert on the HTML)

**Interfaces:**
- Consumes: `ChatMessage` (Task 1).
- Produces: `export function ChatTranscript({ messages }: { messages: ChatMessage[] }): JSX.Element` and
  `export function SkillReportCard({ report }: { report: any }): JSX.Element`.

- [ ] **Step 1 (RED):** test with a fixture `ChatMessage[]` containing: a `user` bubble ("how is
  Maya?"), an `assistant` plumbing turn (`content:'{"__assistantToolCalls":[…]}'`) that MUST NOT
  render its raw JSON, a `tool` message
  (`content:'{"toolName":"get_student_skill_report","args":{},"result":{"skills":[{"slug":"decimal-division","name":"Decimal Division","accuracy":0.4,"attempted":10,"sufficientEvidence":true}]}}'`)
  that renders a card containing "Decimal Division" and "40%", a plain `assistant` bubble
  ("She's strongest at…"), and a `user` message starting with `(system)` rendered as a status line
  not a user bubble. Assert: the `__assistantToolCalls` JSON string does NOT appear in the output;
  "Decimal Division" and "40%" DO; the `(system)` text is present but not in a user bubble element.
- [ ] **Step 2: verify RED. Step 3: implement.** `ChatTranscript` maps messages per the Global
  Constraints "Transcript rendering rules": hide `__assistantToolCalls` turns; a `tool` message with
  `toolName === 'get_student_skill_report'` → `<SkillReportCard report={result} />`; other tool
  messages → a compact "Looked up <toolName>" note; `(system)`-prefixed user messages → a muted
  status line; else user/assistant bubbles. `SkillReportCard` renders the skills as a small table
  (name, accuracy as `Math.round(accuracy*100)%`, n=attempted, an "insufficient evidence" tag when
  `!sufficientEvidence`). Brand palette, flat cards.
- [ ] **Step 4: GREEN** + typecheck. **Step 5: Commit.**
  `git commit -m "feat(m3b2): chat transcript + skill-report data card renderers"`

---

### Task 4: Coach Chat page

**Files:**
- Create: `frontend/src/pages/CoachChat.tsx`
- Modify: `frontend/src/App.tsx` (route `/coach` under `RequireAdmin`), `frontend/src/components/Sidebar.tsx` (admin-only "Coach" link)
- Test: `e2e/m3b2-coach-chat.spec.ts`

**Interfaces:**
- Consumes: `chatApi` (Task 1), `ChatTranscript` (Task 3).

- [ ] **Step 1 (RED):** e2e (admin storageState) with a per-spec 3106 stub scripting
  `[tool_call get_student_skill_report] → [narration]` then (second message)
  `[tool_call create_intervention] → [narration]` (copy `e2e/helpers/chat-stub.ts`; seed a tagged
  attempt for the student like `e2e/m3b-interventions.spec.ts`). Visit `/coach`; type a message
  naming the student, send; assert a data card with the skill name appears and ≥1 suggested-question
  chip renders; click a chip → it sends (a new user bubble appears). Second message triggers a
  **confirmation card** with Confirm/Cancel; assert clicking Confirm makes the pending card resolve
  (a follow-up assistant bubble appears) and clicking would-be Cancel path is present. Student
  storageState: no "Coach" link + `/coach` redirects to `/dashboard`.
- [ ] **Step 2: verify RED. Step 3: implement** `CoachChat.tsx`: on mount create-or-list a session;
  a message list (`ChatTranscript`), a text input + Send, `suggestedQuestions` as clickable chips
  under the transcript, and when `pendingAction` is set a confirmation card showing the action
  (`toolName` + a readable summary of `args`) with **Confirm**/**Cancel** calling
  `chatApi.confirm(sessionId, pendingAction.id, true/false)`. Loading state while awaiting the model
  (it hits real AI — show a "thinking…" indicator). Add the route + sidebar link (admin-only). No
  gradients; calm layout consistent with the app.
- [ ] **Step 4: GREEN + full suites. Step 5: live screenshot** of `/coach` mid-conversation (data
  card + chips + a confirmation card). **Step 6: Commit.**
  `git commit -m "feat(m3b2): Coach Chat page"`

---

### Task 5: Improvement Journey timeline (admin student view)

**Files:**
- Create: `frontend/src/components/ImprovementJourney.tsx`
- Modify: `frontend/src/pages/Admin.tsx` (render it in the per-student performance section)
- Test: `e2e/m3b2-improvement-journey.spec.ts`

**Interfaces:**
- Consumes: `interventionsApi.list` (Task 1). `Admin.tsx` already has `performanceStudentId`.

- [ ] **Step 1 (RED):** e2e (admin): create an intervention for the e2e student (via the chat-confirm
  flow with a 3106 stub, or a seeded fixture — reuse `e2e/m3b-interventions.spec.ts`'s creation
  path), then on `/admin` select that student; assert the Improvement Journey shows a card with the
  intervention's recommendation text, the frozen diagnosis skill name, and an outcome status label
  (one of "Improving"/"Not yet improving"/"Not enough data yet"). When no student is selected or the
  student has none, assert an empty-state message.
- [ ] **Step 2: verify RED. Step 3: implement** `ImprovementJourney({ studentId })`: fetch
  `interventionsApi.list(studentId)`; render reverse-chronological cards — each shows the frozen
  diagnosis (parse `diagnosisSnapshot`, list targeted skills with their snapshot accuracy),
  `recommendation` + `rationale` verbatim, a "View conversation" link to `/coach?session=<chatSessionId>`
  when present, worksheet/coaching artifact counts, and the live outcome panel (per-skill
  before → postAccuracy + a status chip; map statuses to friendly labels + brand colors:
  improving=green, not-yet=amber, insufficient=gray). Render it in `Admin.tsx` under the per-student
  performance area, keyed to `performanceStudentId`; empty-state when none.
- [ ] **Step 4: GREEN + full suites. Step 5: live screenshot** of a student's Improvement Journey.
  **Step 6: Commit.** `git commit -m "feat(m3b2): Improvement Journey timeline"`

---

### Task 6: Skill trend chart + workspace-wide Active Interventions strip + heatmap drill-to-skills

**Files:**
- Create: `frontend/src/components/SkillTrendChart.tsx`
- Modify: `backend/src/routes/interventions.ts` (workspace-wide active endpoint),
  `frontend/src/components/ImprovementJourney.tsx` (embed the chart), `frontend/src/pages/Admin.tsx`
  (Active Interventions strip), `frontend/src/components/Heatmap.tsx` (drill a topic → its skills)
- Test: `e2e/m3b2-trend-and-strip.spec.ts`

**Interfaces:**
- Consumes: `getSkillTrend` endpoint (Task 2) via a new `analyticsApi.skillTrend(studentId, slug)` in
  `api.ts`; `interventionsApi.listActive` (Task 1).
- Produces (backend): `GET /api/interventions/active` (requireAdmin, workspace-scoped) → the
  workspace's `status:'active'` interventions, each joined with the student's name and its
  recomputed outcome status: `ActiveIntervention[]` (`{id, studentId, studentName, skillSlugs,
  createdAt, status}`). Mount alongside the existing interventions routes (order it BEFORE
  `GET /:id/outcome` so `/active` isn't captured as an `:id`).

- [ ] **Step 1 (RED, backend):** append to `e2e/m3b2-trend-and-strip.spec.ts` an API check: after
  the chat-confirm flow creates an active intervention for the e2e student, `GET
  /api/interventions/active` (admin) returns an array including it with `studentName` set and a
  `status`; a student-context request → 403; interventions from another workspace are absent. RED
  (route missing) → implement `GET /api/interventions/active` (see Produces) → GREEN.
- [ ] **Step 2 (RED, UI):** e2e (admin): with a student who has ≥2 attempts on a tagged skill and one
  intervention, select them on `/admin`; assert a line chart renders (a Recharts container / SVG
  path is present) for the targeted skill and the workspace **Active Interventions** strip lists the
  student's name + skill. Also assert clicking a topic card in the math heatmap reveals its skill
  sub-cards.
- [ ] **Step 3: implement.** Add `analyticsApi.skillTrend` to `api.ts`.
  `SkillTrendChart({ studentId, slug, interventionDates })`: fetch the trend, render a Recharts
  `LineChart` of `accuracy` over `finishedAt` (mirror `ScoreHistory.tsx`'s LineChart setup) with a
  `<ReferenceLine>` at each intervention `createdAt`; embed it in each Improvement Journey card for
  its first targeted skill. **Active Interventions strip in `Admin.tsx` (workspace-wide):** fetch
  `interventionsApi.listActive()` once and render a card per active intervention across the workspace
  — student name, targeted skills, age (from `createdAt`), and outcome status chip (green improving /
  amber not-yet / gray insufficient), matching the mockup. Heatmap drill: clicking a topic card
  toggles a row of its skills (from `skillsApi.list` grouped by topic) beneath it, using the same
  red-to-green colour treatment.
- [ ] **Step 4: GREEN + full suites + typecheck. Step 5: live screenshot** of the chart with an
  intervention marker + the workspace strip + a drilled topic. **Step 6: Commit.**
  `git commit -m "feat(m3b2): workspace active-interventions endpoint + trend chart, strip, heatmap drill"`

---

## Worklog mapping (create after user approves — CLAUDE.md step 2)

W-51 Task 1 API client · W-52 Task 2 trend endpoint · W-53 Task 3 transcript/card renderers ·
W-54 Task 4 Coach Chat page · W-55 Task 5 Improvement Journey · W-56 Task 6 chart + strip + drill.

## M3b-2 exit criteria (spec §5.6, §6.4)

Admin can hold a Coach Chat with data cards + grounded chips + confirmation cards; accepting a
suggestion records an intervention visible in the Improvement Journey; each intervention shows the
frozen diagnosis, the AI's recommendation/rationale, a "View conversation" link, and a live
before → after outcome; a per-skill accuracy chart shows intervention markers; the heatmap drills to
skills; the Active Interventions strip surfaces open interventions. Then M3c (coaching) is planned.
