# Milestone 3b-1 — Agentic Coach Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The server-side agentic coach — a tool-calling admin chat over the deterministic
analytics service, with confirmation-gated actions and a frozen-snapshot / recomputed-outcome
intervention ledger. No UI (that is M3b-2); everything here is proven via API e2e.

**Architecture:** A new `chatWithTools` primitive extends the AI service with OpenAI
function-calling. A `chat-tools` module exposes read tools (thin adapters over
`analytics.service`) and action tools (confirmation-gated). A `chat.service` runs the tool loop;
`routes/chat.ts` persists sessions/messages and gates actions. An `intervention.service` freezes
a diagnosis snapshot on creation and recomputes outcomes on read. Two M3a follow-ups ride along.

**Tech Stack:** Existing only — Prisma/SQLite, Express, vitest, Playwright. AI via the existing
`providerFor`/`chatCompletion` seam, extended for tools.

**Spec:** `docs/superpowers/specs/2026-07-24-milestone3-agentic-coach-design.md` (§5, §6; §4.9 for
the writing-trends follow-up).

## Global Constraints

- CLAUDE.md mandatory 5-step workflow per task; worklog items W-42…W-50 map to Tasks 1–9, ticked
  only after user sign-off.
- RED first: watch each new test fail before implementing. Full `npm run e2e` + `npm test`
  (frontend + `npm test -w backend`) + `npm run typecheck` green before every commit.
- e2e only against the isolated stack (fresh `e2e.db`, ports 3105/5273, OpenAI stub on 3106).
  The stub is per-spec: each spec starts an `http.createServer` on 3106 responding to
  `/v1/chat/completions` and closes it after (pattern: `e2e/m3a-generation-tags.spec.ts`).
- **Accuracy non-negotiable (spec §0):** every statistic the chat surfaces comes from
  `analytics.service` / `analytics-core` — the model relays tool output, never computes stats.
  No statistics logic outside `analytics-core.ts`.
- **Answer-key hygiene (§0.6):** no new student-reachable response carries
  `correctIndex`/`explanation`. All chat/intervention/analytics routes are `requireAdmin`.
- **Outcomes are never stored** — always recomputed from attempts after the intervention's
  `createdAt` (spec §6.3). `diagnosisSnapshot` is server-computed at creation, never model-supplied.
- **Cost-vs-accuracy (spec §11):** the chat system prompt and tool wiring are judgment work — a
  capable model authors Tasks 4 and 6–7. Schema/plumbing/e2e (Tasks 1–3, 5, 8–9) are safe for a
  cheaper model against the tests spelled out here.
- Chat AI role default model: `gpt-5-mini`. Log every call via the existing `[ai-usage]` logger.

## File structure

- `backend/prisma/schema.prisma` — add `ChatSession`, `ChatMessage`, `Intervention` (§2).
- `backend/src/services/ai.service.ts` — add `chatWithTools` + `'chat'` role.
- `backend/src/services/chat-tools.ts` — tool JSON schemas + `dispatchTool` (read) / action descriptors.
- `backend/src/services/chat.service.ts` — the tool loop + system prompt + suggestedQuestions.
- `backend/src/lib/pending-actions.ts` — in-memory pending-action map (mirror `generation-jobs.ts`).
- `backend/src/services/intervention.service.ts` — snapshot freeze + outcome recompute.
- `backend/src/routes/chat.ts`, `backend/src/routes/interventions.ts` — mounted in `src/index.ts`.
- Follow-ups: `backend/src/services/math-worksheet.service.ts` (Task 2),
  `backend/src/services/analytics-core.ts` + `analytics.service.ts` (Task 3).

---

### Task 1: Schema — ChatSession, ChatMessage, Intervention

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: `backend/prisma/migrations/*_m3b_chat_interventions/`

**Interfaces:**
- Produces: models exactly as spec §2 (M3b block). `ChatSession(id, workspaceId, adminId, title,
  createdAt, messages[], interventions[])`; `ChatMessage(id, sessionId, role, content, createdAt)`
  with `onDelete: Cascade`; `Intervention(id, workspaceId, studentId, createdById, chatSessionId?,
  skillSlugs, diagnosisSnapshot, recommendation, rationale, worksheetIds, coachingModuleIds,
  status @default("active"), createdAt)`. All the String JSON fields are `String`.

- [ ] **Step 1: Add the three models** to `schema.prisma` verbatim from spec §2 (M3b block),
  plus the back-relations: on `User` add `chatSessions ChatSession[]` and `interventions
  Intervention[] @relation("InterventionStudent")` + `createdInterventions Intervention[]
  @relation("InterventionCreator")`; wire `Intervention.studentId`/`createdById` to those named
  relations; on `Workspace` add `chatSessions ChatSession[]` and `interventions Intervention[]`.
- [ ] **Step 2: Migrate + regenerate.** Run: `cd backend && npx prisma migrate dev --name m3b_chat_interventions`. Expected: applied, client regenerated.
- [ ] **Step 3: Typecheck.** Run `npm run typecheck`. Expected: clean.
- [ ] **Step 4: Commit.** `git add backend/prisma && git commit -m "feat(m3b): ChatSession/ChatMessage/Intervention schema"`

---

### Task 2 (follow-up): Enforce skill topic/subject membership on save

**Files:**
- Modify: `backend/src/services/math-worksheet.service.ts` (`createWorksheetQuestionRows`)
- Test: `e2e/m3b-save-membership.spec.ts`

**Interfaces:**
- Consumes: `MATH_SKILLS` (`backend/prisma/seed-skills.ts`) and the `Skill` table.
- Produces: `createWorksheetQuestionRows` throws `Skill slug X does not belong to topic Y` when a
  question's `skillSlug` resolves to a skill whose `subject!=='math'` or whose `topicId` differs
  from the question's topic — surfaced as 400 like the existing `Unknown skill slug` error.

- [ ] **Step 1 (RED):** `e2e/m3b-save-membership.spec.ts` (admin storageState): POST
  `/api/math/worksheets/save` with one arithmetic question tagged `skillSlug: 'vocabulary'` (a
  writing slug) → expect 400 with a message containing "does not belong". Today it saves 201.
- [ ] **Step 2: verify RED** — `npm run e2e -- m3b-save-membership`; expect FAIL (201).
- [ ] **Step 3: implement.** In `createWorksheetQuestionRows`, after resolving `skillId` by slug,
  also load the skill's `subject`+`topicId` (use the same `findMany({ slug: { in } })` batch the
  topic resolution uses) and the question's topic id; if `skill.subject !== 'math'` or
  `skill.topicId !== questionTopicId`, throw `Error(\`Skill slug ${slug} does not belong to topic ${topicSlug}\`)`. Keep the existing unknown-slug throw.
- [ ] **Step 4: verify GREEN** + full suites. **Step 5: Commit.** `git commit -m "fix(m3b): enforce skill topic/subject membership on worksheet save"`

---

### Task 3 (follow-up §4.9): Writing time-used and word-count trends

**Files:**
- Modify: `backend/src/services/analytics-core.ts` (extend `computeWritingSignals` output),
  `backend/src/services/analytics.service.ts` (writing adapter + `StudentSkillReport`)
- Test: append to `backend/src/services/analytics-core.test.ts`

**Interfaces:**
- Produces: `WritingAnalysisRecord` gains `timeTakenSec: number | null`, `timeLimitSec: number |
  null`, `wordCount: number | null`. `computeWritingSignals` return type gains a sibling summary
  `computeWritingUsage(records): { timeUsedRatioMean: number | null; timeUsedRatioTrendPts:
  number | null; wordCountMean: number | null; wordCountTrendPts: number | null; n: number }`.
  `StudentSkillReport` gains optional `writingUsage?: ReturnType<typeof computeWritingUsage>`.

- [ ] **Step 1 (RED): transcribe exactly:**

```ts
import { computeWritingUsage } from './analytics-core';
describe('computeWritingUsage', () => {
  const rec = (day: number, over: any) => ({ finishedAt: `2026-07-0${day}T00:00:00.000Z`, criteriaScores: {}, ...over });
  it('means + halves trend on ratio and word count', () => {
    const recs = [
      rec(1, { timeTakenSec: 300, timeLimitSec: 600, wordCount: 100 }), // ratio 0.5
      rec(2, { timeTakenSec: 360, timeLimitSec: 600, wordCount: 120 }), // ratio 0.6
      rec(3, { timeTakenSec: 480, timeLimitSec: 600, wordCount: 160 }), // ratio 0.8
      rec(4, { timeTakenSec: 540, timeLimitSec: 600, wordCount: 200 }), // ratio 0.9
    ];
    const u = computeWritingUsage(recs);
    expect(u.timeUsedRatioMean!).toBeCloseTo(0.7, 6);         // (0.5+0.6+0.8+0.9)/4
    expect(u.timeUsedRatioTrendPts!).toBeCloseTo(0.3, 6);      // newer[0.8,0.9]=0.85 − older[0.5,0.6]=0.55
    expect(u.wordCountMean!).toBeCloseTo(145, 6);
    expect(u.wordCountTrendPts!).toBeCloseTo(70, 6);           // 180 − 110
    expect(u.n).toBe(4);
  });
  it('rows missing a field are skipped for that field; empty → nulls', () => {
    expect(computeWritingUsage([]).timeUsedRatioMean).toBeNull();
    const one = computeWritingUsage([rec(1, { timeTakenSec: null, timeLimitSec: 600, wordCount: 50 })]);
    expect(one.timeUsedRatioMean).toBeNull();       // no ratio (null time)
    expect(one.wordCountMean).toBeCloseTo(50, 6);
  });
});
```

- [ ] **Step 2: verify RED** (`npm test -w backend -- analytics-core`; function missing).
- [ ] **Step 3: implement** `computeWritingUsage`: ratio = `timeTakenSec/timeLimitSec` only when
  both present and `timeLimitSec>0`; means over present values (null if none); trend via the same
  `splitAttemptHalves`-style ordering used by `computeWritingSignals` (older half = first
  `ceil(k/2)` by `finishedAt`; each half needs ≥2 present values else null; ratio trend is a raw
  difference, word-count trend a raw difference — neither ×100). In `analytics.service.ts` map
  `Attempt.timeTaken`→`timeTakenSec`, the writing type's time limit→`timeLimitSec` (compute the
  same way `TimedPractice` does — read from the type/config; if unavailable set null), and word
  count = `attempt.text.trim().split(/\s+/).filter(Boolean).length`; attach `writingUsage` to the
  writing report only.
- [ ] **Step 4: verify GREEN** + full suites + typecheck. **Step 5: Commit.**
  `git commit -m "feat(m3b): writing time-used and word-count trends (spec §4.9)"`

---

### Task 4: `chatWithTools` primitive + `'chat'` AI role  ⚠️ capable-model

**Files:**
- Modify: `backend/src/services/ai.service.ts`
- Test: `backend/src/services/ai.service.test.ts` (new; mock `fetch`)

**Interfaces:**
- Produces:
```ts
export interface ToolCall { id: string; name: string; arguments: string } // arguments = raw JSON string
export interface ChatTurn { role: 'system' | 'user' | 'assistant' | 'tool'; content: string;
  toolCallId?: string; toolCalls?: ToolCall[] }
export interface ChatToolSchema { name: string; description: string; parameters: object } // JSON Schema
export async function chatWithTools(provider: ModelProvider, messages: ChatTurn[],
  tools: ChatToolSchema[], maxTokens: number): Promise<{ content: string; toolCalls: ToolCall[]; usage: Usage | null }>;
```
- `'chat'` added to `ModelRole`; `ROLE_DEFAULTS.chat = 'gpt-5-mini'`.

- [ ] **Step 1 (RED):** unit test with a mocked `global.fetch` returning an OpenAI-shaped body
  whose `choices[0].message` has `tool_calls: [{ id:'c1', type:'function', function:{ name:'get_x',
  arguments:'{"a":1}' }}]` and null content → assert `chatWithTools` returns
  `toolCalls:[{id:'c1',name:'get_x',arguments:'{"a":1}'}]`, `content:''`. Second case: message
  with `content:'hello'`, no tool_calls → returns `content:'hello', toolCalls:[]`. Assert the
  request body sent `tools` (mapped to `[{type:'function', function:{name,description,parameters}}]`)
  and the messages (tool turns mapped to `{role:'tool', tool_call_id, content}`; assistant tool
  calls mapped to `{role:'assistant', tool_calls:[...]}`).
- [ ] **Step 2: verify RED** (`npm test -w backend -- ai.service`).
- [ ] **Step 3: implement** `chatWithTools`: builds the request like `chatCompletion` (same
  `tokensParam`, reasoning-model temperature rule — omit temperature), adds `tools` and
  `tool_choice:'auto'`, serialises `messages` to the OpenAI wire shape, logs `[ai-usage]` with
  role `chat`, returns parsed content + tool calls. Add `'chat'` to `ModelRole` + defaults.
- [ ] **Step 4: verify GREEN** + `npm run typecheck`. **Step 5: Commit.**
  `git commit -m "feat(m3b): chatWithTools tool-calling primitive + chat role"`

---

### Task 5: Read tools — schemas + dispatch

**Files:**
- Create: `backend/src/services/chat-tools.ts`
- Test: `backend/src/services/chat-tools.test.ts`

**Interfaces:**
- Consumes: `analytics.service` (`getStudentSkillReport`, `getOpportunityAreas`), Prisma,
  `intervention.service` (Task 8 — for `get_intervention_history`; until then that tool returns
  `[]`, replaced in Task 8).
- Produces:
```ts
export interface ToolContext { workspaceId: number; adminId: number }
export const READ_TOOL_SCHEMAS: ChatToolSchema[];        // list_students, get_student_skill_report, get_opportunity_areas, get_attempt_details, get_intervention_history
export const ACTION_TOOL_SCHEMAS: ChatToolSchema[];      // generate_worksheet, save_and_assign_worksheet, create_intervention (Task 6 fills behaviour)
export function isActionTool(name: string): boolean;
export async function dispatchReadTool(name: string, args: any, ctx: ToolContext): Promise<unknown>;
```
(Coaching tools are M3c — omit `get_coaching_modules`/`assign_coaching` here.)

- [ ] **Step 1 (RED):** `chat-tools.test.ts` — seed (via the e2e/dev prisma? no: unit-test the
  pure parts). Concretely: assert `READ_TOOL_SCHEMAS` contains exactly the 5 names above with
  non-empty `description` and a `parameters` object with `type:'object'`; assert
  `isActionTool('get_student_skill_report')===false` and `isActionTool('create_intervention')===true`.
  (Behavioural dispatch is covered by the chat e2e in Task 7 — dispatch calls the real
  analytics/prisma layer, which is integration-tested there, not unit-mocked here.)
- [ ] **Step 2: verify RED. Step 3: implement.** Schemas as above (each read tool's parameters:
  `get_student_skill_report` → `{studentId:int, subject:'math'|'writing', lastNTests?:int}`;
  `get_opportunity_areas` → `{subject, studentId?}`; `get_attempt_details` → `{attemptId:int}`;
  `list_students`/`get_intervention_history` → `{}`/`{studentId:int}`). `dispatchReadTool`
  workspace-scopes everything: `list_students` → prisma students in `ctx.workspaceId`;
  `get_student_skill_report`/`get_opportunity_areas` → verify the target student is in the
  workspace (reuse `canAccessUser`-style check by workspace) then call the analytics service;
  `get_attempt_details` → the existing attempt-detail read, workspace-checked, **answer key
  stripped** unless needed for admin narration (it is admin-only, so full detail is allowed);
  `get_intervention_history` → `[]` placeholder (Task 8 replaces).
- [ ] **Step 4: verify GREEN** + full suites. **Step 5: Commit.**
  `git commit -m "feat(m3b): chat read-tool schemas + dispatch"`

---

### Task 6: Action tools + confirmation gating  ⚠️ capable-model

**Files:**
- Create: `backend/src/lib/pending-actions.ts`
- Modify: `backend/src/services/chat-tools.ts` (action executors)
- Test: `backend/src/lib/pending-actions.test.ts`

**Interfaces:**
- Produces:
```ts
// pending-actions.ts (mirror generation-jobs.ts: in-memory Map keyed by uuid, workspace-scoped)
export interface PendingAction { id: string; workspaceId: number; toolName: string; args: any; createdAt: number }
export function createPendingAction(workspaceId: number, toolName: string, args: any): PendingAction;
export function getPendingAction(id: string, workspaceId: number): PendingAction | undefined;
export function deletePendingAction(id: string): void;
// chat-tools.ts
export async function executeActionTool(name: string, args: any, ctx: ToolContext): Promise<unknown>;
```
- Action tools: `generate_worksheet` (subject, topicSlugs?/skillSlugs?, questionCount 5–50 — reuses
  the existing generation job), `save_and_assign_worksheet` (reuses the existing save+assign),
  `create_intervention` (delegates to `intervention.service` in Task 8).

- [ ] **Step 1 (RED):** `pending-actions.test.ts` — create → get by id+workspace returns it; get
  with a different `workspaceId` returns undefined; delete removes it. (Uuid uniqueness across two
  creates.)
- [ ] **Step 2: verify RED. Step 3: implement** `pending-actions.ts` (copy `generation-jobs.ts`
  structure) and `executeActionTool` (calls the existing generation/save services;
  `create_intervention` throws "not wired" until Task 8, then Task 8 completes it).
- [ ] **Step 4: verify GREEN** + typecheck. **Step 5: Commit.**
  `git commit -m "feat(m3b): pending-action store + action-tool executors"`

---

### Task 7: Chat service tool loop + system prompt  ⚠️ capable-model

**Files:**
- Create: `backend/src/services/chat.service.ts`
- Test: covered by the Task 8 chat e2e (the loop needs the stub + DB; no separate unit test —
  the loop is orchestration over already-tested units).

**Interfaces:**
- Produces:
```ts
export interface ChatStepResult { messages: ChatMessage[]; suggestedQuestions: string[]; pendingAction?: { id: string; toolName: string; args: any } }
export async function runChatStep(sessionId: number, userText: string, ctx: ToolContext): Promise<ChatStepResult>;
export async function resolvePendingAction(sessionId: number, actionId: string, approve: boolean, ctx: ToolContext): Promise<ChatStepResult>;
```

- [ ] **Step 1: implement** (no separate RED — verified by Task 8's e2e, which is written first
  there): persist the user message; build the transcript from `ChatMessage` rows + the system
  prompt template; loop (max 8 iterations): `chatWithTools(providerFor('chat'), …,
  [...READ_TOOL_SCHEMAS, ...ACTION_TOOL_SCHEMAS], …)`; a read tool → `dispatchReadTool`, persist a
  `role:'tool'` message with `JSON.stringify({toolName,args,result})`, continue; an action tool →
  `createPendingAction`, stop and return it as `pendingAction`; plain content → persist assistant
  message, stop. After the first assistant turn following a student being named, populate
  `suggestedQuestions` (3–5) — derive them from the most recent `get_student_skill_report` tool
  result in the transcript (worst sufficient-evidence skills, slow-wrong skills). `resolvePendingAction`:
  on approve → `executeActionTool`, feed the result back as a tool message and run one more loop
  iteration; on deny → feed "the admin declined" and continue. System prompt (store as a template
  constant): never state a number absent from tool output; call `get_student_skill_report` first
  when the admin names a student; respect `sufficientEvidence:false`; when composing an
  intervention worksheet ensure ≥8 questions per targeted skill and say so.
- [ ] **Step 2: typecheck** clean. **Step 3: Commit.**
  `git commit -m "feat(m3b): chat tool loop + grounded system prompt"`

---

### Task 8: Intervention service — snapshot + recomputed outcome

**Files:**
- Create: `backend/src/services/intervention.service.ts`
- Modify: `backend/src/services/chat-tools.ts` (wire `create_intervention` + `get_intervention_history`)
- Test: `backend/src/services/intervention.service.test.ts` (outcome-status pure logic) + e2e in Task 9

**Interfaces:**
- Produces:
```ts
export function outcomeStatus(snapshotAccuracy: number, postAttempted: number, postAccuracy: number): 'insufficient-evidence' | 'improving' | 'not-yet-improving';
export async function createIntervention(input: { workspaceId, studentId, createdById, chatSessionId?, skillSlugs: string[], recommendation: string, rationale: string, worksheetIds?, coachingModuleIds? }): Promise<Intervention>;
export async function getInterventionOutcome(interventionId: number): Promise<{ perSkill: Array<{ slug: string; before: number; postAttempted: number; postAccuracy: number; status: string }>; status: string }>;
export async function listInterventions(studentId: number): Promise<Array<Intervention & { outcome: ... }>>;
```

- [ ] **Step 1 (RED): `outcomeStatus` vectors (exact):**

```ts
import { outcomeStatus } from './intervention.service';
describe('outcomeStatus', () => {
  it('post-attempted < 8 → insufficient regardless of accuracy', () =>
    expect(outcomeStatus(0.4, 7, 0.99)).toBe('insufficient-evidence'));
  it('improving needs +10 points and ≥8 attempted', () => {
    expect(outcomeStatus(0.40, 8, 0.50)).toBe('improving');   // +10 exactly
    expect(outcomeStatus(0.40, 8, 0.4999)).toBe('not-yet-improving');
  });
});
```

- [ ] **Step 2: verify RED. Step 3: implement.** `outcomeStatus`: `postAttempted<8` →
  `insufficient-evidence`; else `postAccuracy >= snapshotAccuracy + 0.10` → `improving`; else
  `not-yet-improving`. `createIntervention`: recompute the report NOW, freeze the targeted skills'
  signals into `diagnosisSnapshot` per spec §6.2, persist. `getInterventionOutcome`: recompute per
  targeted skill over attempts with `finishedAt > createdAt`; intervention-level status = worst
  (any `not-yet-improving` → that; else any `insufficient-evidence` → that; else `improving`).
  Wire `create_intervention` (Task 6 executor) and `get_intervention_history` (Task 5 dispatch) to
  these. Snapshot accuracy source = the frozen signal's `accuracy`.
- [ ] **Step 4: verify GREEN** + full suites. **Step 5: Commit.**
  `git commit -m "feat(m3b): intervention snapshot + recomputed outcome"`

---

### Task 9: Chat + interventions API routes (+ chat e2e)

**Files:**
- Create: `backend/src/routes/chat.ts`, `backend/src/routes/interventions.ts`
- Modify: `backend/src/index.ts` (mount `/api/chat`, `/api/interventions`)
- Test: `e2e/m3b-chat.spec.ts`, `e2e/m3b-interventions.spec.ts`

**Interfaces:**
- Routes (all `requireAdmin`, workspace-scoped): `POST /api/chat/sessions`; `GET
  /api/chat/sessions`; `GET /api/chat/sessions/:id`; `POST /api/chat/sessions/:id/messages`
  `{content}` → `ChatStepResult`; `POST /api/chat/sessions/:id/confirm` `{actionId, approve}` →
  `ChatStepResult`. `GET /api/interventions?studentId=`; `GET /api/interventions/:id/outcome`.
  (Intervention creation is chat-only via confirm — no public POST.)

- [ ] **Step 1 (RED): `e2e/m3b-chat.spec.ts`** with a 3106 stub scripting a tool-call sequence
  (copy the stub-server pattern from `e2e/m3a-generation-tags.spec.ts`): the stub returns, in
  order, (a) a `tool_calls` response for `get_student_skill_report`, then (b) a final assistant
  message citing a number present in the tool result + `suggestedQuestions`. As admin: create a
  session, POST a message naming the seeded e2e student; assert the response contains a `tool`
  message whose result is the report, an assistant message, and ≥1 `suggestedQuestions`. Second
  test: stub scripts a `create_intervention` action tool → assert the message response carries a
  `pendingAction` and **no** Intervention row exists yet; POST `/confirm {approve:true}` → assert
  an Intervention row now exists with a frozen `diagnosisSnapshot`. Third: a student-context POST
  to any `/api/chat/*` → 403.
- [ ] **Step 2: `e2e/m3b-interventions.spec.ts`** — after creating an intervention (via the chat
  confirm flow or a direct service call through a seeded fixture), submit a post-intervention
  attempt for the student that raises the skill's accuracy, then `GET
  /api/interventions/:id/outcome` and assert the per-skill before/postAccuracy and status
  transition (`insufficient-evidence` until ≥8 post-attempted). Answer keys sourced via an admin
  request (W-28 pattern).
- [ ] **Step 3: verify RED** on both (routes missing). **Step 4: implement** the routers +
  mount; `POST messages` → `runChatStep`; `confirm` → `resolvePendingAction`.
- [ ] **Step 5: verify GREEN** + FULL `npm run e2e` + `npm test` + `npm run typecheck`.
  **Step 6: Commit.** `git commit -m "feat(m3b): chat + interventions API with agent e2e"`

---

## Worklog mapping (create after user approves — CLAUDE.md step 2)

W-42 Task 1 schema · W-43 Task 2 save-membership · W-44 Task 3 writing usage trends ·
W-45 Task 4 chatWithTools · W-46 Task 5 read tools · W-47 Task 6 action tools + gating ·
W-48 Task 7 chat loop · W-49 Task 8 intervention service · W-50 Task 9 chat/intervention API.

## M3b-1 exit criteria

Admin can, via API: open a chat, ask about a student and get a grounded answer whose numbers all
come from tool results, receive suggested follow-ups, and accept a suggestion that creates an
intervention with a frozen diagnosis snapshot; intervention outcomes recompute from later
attempts; students are denied on every route; no answer key leaks. Then M3b-2 (the Coach Chat and
Improvement Journey UI) is planned and built on this API.
