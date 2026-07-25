# M3c Phase 2 — Coaching library + student lessons — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin generate, verify, edit and approve per-skill coaching lessons, and let a
student browse, learn and complete those lessons — with learn→practise ordering and post-test
"Learn the method" links — for MATH skills.

**Architecture:** A background generation job (copy of the worksheet job) runs a judgment-authored
generation prompt then an arithmetic verifier, retrying once. A new `/api/coaching` router mirrors
`math-worksheets.ts`. The chat agent gains one `assign_coaching` action tool through the existing
`pending-actions` gate. The frontend adds a module editor (admin), a Lessons library and a Lesson
page (student), plus learn→practise ordering in the pending list and a review-weaving link.

**Tech Stack:** Express 4 + Prisma 5 + SQLite (backend); Vite + React 18 + TS + Tailwind
(frontend); OpenAI-compatible calls via the existing `providerFor(role)` seam; **react-markdown**
(new dep) for rendering module markdown; Playwright + Vitest for tests.

## Global Constraints

- **Design source of truth:** `docs/superpowers/specs/2026-07-25-m3c-phase2-coaching-design.md`
  (refines §8 of `docs/superpowers/specs/2026-07-24-milestone3-agentic-coach-design.md`).
- **Math skills only.** Writing modules are a later follow-up. Do not build writing coaching.
- **No schema changes.** `CoachingModule` and `CoachingAssignment` already exist as specified in
  §2 of the parent spec. `CoachingAssignment` has `@@unique([moduleId, studentId])`.
- **Approved-only visibility (§8.2):** students may only ever receive a module with
  `status === 'approved'`. A student requesting a `draft` module id gets **404** (never 403 — do
  not reveal existence). All module/assignment rows are workspace-scoped (`workspaceId`).
- **Cost vs accuracy (§11):** the generation prompt (Task 1) and the verifier prompt (Task 1) are
  **judgment work** — authored by a capable model, never delegated to a weaker one. Routes, Prisma
  plumbing, job scaffolding, UI, and e2e specs whose scenarios are spelled out here are safe for
  cheaper models with these tests in hand.
- **Answer-key hygiene (§0.6):** every student-reachable response is teaching text; no route
  returns a non-approved module; generation/verifier prompts never embed a live worksheet key.
- **Look and feel:** brand blue (`#1c6dd0`) / green (`#2e9e5b`) / amber (`#f2a71b`) + navy sidebar;
  no gradients, no purple, no single-accent-border cards. The Lesson page stays calm and uncluttered.
- **Mandatory workflow (`CLAUDE.md`):** every task is RED-first (failing test → GREEN), full
  `npm run e2e` + `npm test` + `npm run typecheck` green before the phase is handed over, then user
  manual sign-off before any worklog box is ticked.
- **e2e stack:** fresh `e2e.db`, backend 3105 / frontend 5273, OpenAI stub on 3106 via
  `e2e/helpers/chat-stub.ts`. Never hit real OpenAI or `dev.db`.

---

# Phase 2a — Admin authoring

Ships independently: an admin can generate, review, edit and approve a math coaching module; drafts
are invisible to students. Hand over for sign-off before starting Phase 2b.

### Task 1: Coaching generation service (generate → verify → retry-once)

**Files:**
- Create: `backend/src/services/coaching.service.ts`
- Test: `backend/src/services/coaching.service.test.ts`

**Interfaces:**
- Consumes: `providerFor`, `chatCompletion` from `ai.service.ts`; `prisma` from the shared client.
- Produces:
  - `interface GeneratedModule { title: string; content: string; verifierWarnings: string[] }`
  - `async function generateCoachingModuleContent(skill: { name: string; slug: string; examLevelNotes: string; misconceptions?: string[] }): Promise<GeneratedModule>`
    — runs the generation prompt, then the verifier; if the verifier flags any worked example,
    regenerates **once** with the findings appended; returns the final content plus any warnings
    still present after the retry.
  - `async function verifyWorkedExamples(content: string): Promise<string[]>` — returns a list of
    human-readable warnings (empty = all examples check out). Exported for direct unit testing.

**Prompt authoring note (judgment work, §11):** the generation prompt is authored by the
implementing (capable) model. It MUST instruct the model to produce markdown in this exact section
order — `## The idea` → `## Step by step` → `## Speed technique` (omit if none applies) →
`## Worked examples` (2–3) → `## Traps to avoid` — anchored on the skill's `examLevelNotes` and
misconceptions, in the §8.1 **student voice** (direct "you", short sentences, tricks worth showing
off, traps as "gotchas the test setters hope you fall for", under a 5-minute read, no babyish
tone, no walls of text). It returns markdown only (no JSON, no code fences). The verifier prompt
instructs the `verification` role to check the arithmetic of every worked example and return
`{"ok": boolean, "warnings": string[]}` (JSON only). Use `providerFor('generation')` and
`providerFor('verification')` respectively, via `chatCompletion`.

- [ ] **Step 1: Write the failing test** (control flow, AI stubbed — retry fires exactly once)

```typescript
// backend/src/services/coaching.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chatCompletion = vi.fn();
vi.mock('./ai.service', () => ({
  providerFor: (role: string) => ({ model: `stub-${role}`, baseUrl: '', apiKey: '', tokensParam: 'max_tokens' }),
  chatCompletion: (...args: any[]) => chatCompletion(...args),
}));

import { generateCoachingModuleContent } from './coaching.service';

const skill = { name: 'Balancing Number Sentences', slug: 'balancing-number-sentences', examLevelNotes: 'notes', misconceptions: ['adds instead of subtracts'] };

beforeEach(() => chatCompletion.mockReset());

describe('generateCoachingModuleContent', () => {
  it('retries generation exactly once when the verifier flags an example, then succeeds', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nbad example 7x8=54', usage: null })      // gen #1
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["Example 1: 7x8 is 56, not 54"]}', usage: null }) // verify #1
      .mockResolvedValueOnce({ content: '## The idea\ngood example 7x8=56', usage: null })      // gen #2 (retry)
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });            // verify #2

    const result = await generateCoachingModuleContent(skill);

    expect(chatCompletion).toHaveBeenCalledTimes(4); // gen, verify, gen(retry), verify
    expect(result.verifierWarnings).toEqual([]);
    expect(result.content).toContain('7x8=56');
  });

  it('saves the draft with warnings attached when the retry still fails', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: 'gen1 bad', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["still wrong"]}', usage: null })
      .mockResolvedValueOnce({ content: 'gen2 still bad', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["still wrong again"]}', usage: null });

    const result = await generateCoachingModuleContent(skill);

    expect(chatCompletion).toHaveBeenCalledTimes(4); // exactly one retry, no more
    expect(result.verifierWarnings).toEqual(['still wrong again']);
    expect(result.content).toBe('gen2 still bad');
  });
});
```

- [ ] **Step 2: Run test to verify it fails** — `npm test -w backend -- coaching.service` → FAIL
  (module not found / function undefined).
- [ ] **Step 3: Implement `coaching.service.ts`** — the generation prompt + verifier prompt
  (authored per the note above) and this control flow:

```typescript
export interface GeneratedModule { title: string; content: string; verifierWarnings: string[] }

export async function verifyWorkedExamples(content: string): Promise<string[]> {
  const prompt = /* judgment-authored verifier prompt embedding `content`, asks for {"ok",warnings[]} JSON only */;
  const { content: raw } = await chatCompletion(providerFor('verification'), prompt, 2000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const verdict = JSON.parse(match[0]) as { ok: boolean; warnings?: string[] };
    return verdict.ok ? [] : (verdict.warnings ?? ['Verifier flagged a worked example']);
  } catch { return []; }
}

async function generateOnce(skill: GenInput, feedback?: string[]): Promise<string> {
  const prompt = /* judgment-authored generation prompt; append feedback list when present */;
  const { content } = await chatCompletion(providerFor('generation'), prompt, 3000, 0.7);
  return content.trim();
}

export async function generateCoachingModuleContent(skill: GenInput): Promise<GeneratedModule> {
  let content = await generateOnce(skill);
  let warnings = await verifyWorkedExamples(content);
  if (warnings.length > 0) {                    // exactly one retry
    content = await generateOnce(skill, warnings);
    warnings = await verifyWorkedExamples(content);
  }
  return { title: `${skill.name}`, content, verifierWarnings: warnings };
}
```

- [ ] **Step 4: Run test to verify it passes** — `npm test -w backend -- coaching.service` → PASS.
- [ ] **Step 5: Commit** — `git add backend/src/services/coaching.service.ts backend/src/services/coaching.service.test.ts && git commit -m "feat(coaching): generation+verify service with one retry"`

---

### Task 2: Coaching router (generate job, poll, list, get w/ visibility, edit, approve)

**Files:**
- Create: `backend/src/routes/coaching.ts`
- Modify: `backend/src/index.ts` (mount `app.use('/api/coaching', coachingRouter)` after the
  interventions router, line ~68)
- Test: `e2e/m3c2-coaching-admin.spec.ts` (created in Task 7; this task adds the routes those
  scenarios exercise). A backend unit test for the visibility gate is added here.
- Test: `backend/src/routes/coaching.visibility.test.ts` (student draft → 404)

**Interfaces:**
- Consumes: `generateCoachingModuleContent` (Task 1); `createJob`, `getJobForWorkspace` from
  `../lib/generation-jobs`; `requireAuth`, `requireAdmin`, `asyncHandler`; `prisma`.
- Produces these routes (all workspace-scoped):
  - `POST /api/coaching/modules/generate` `{ skillId }` (requireAdmin) → `202 { jobId }`. The job's
    `run` loads the skill (must be `subject:'math'` in the workspace), calls
    `generateCoachingModuleContent`, then creates a `CoachingModule` row (`status:'draft'`,
    `version:1`, `workspaceId`, `skillId`) and returns `{ moduleId, verifierWarnings }` as the job
    result.
  - `GET /api/coaching/jobs/:jobId` (requireAdmin) → `{ status, result, error }` (copy
    `math-worksheets.ts` job poll).
  - `GET /api/coaching/modules?skillId=` (requireAdmin) → modules for that skill (draft + approved),
    workspace-scoped. With `?approved=1` and NO `skillId`, see Task 8 (student library) — guard so
    admins hitting `?skillId=` still get drafts.
  - `GET /api/coaching/modules/:id` (requireAuth) → the module. Admins get any in their workspace.
    **Students: only if `status==='approved'`, else 404.** Also 404 if not in caller's workspace.
  - `PATCH /api/coaching/modules/:id` `{ title?, content? }` (requireAdmin) → updates; if the module
    was already `approved`, increment `version`.
  - `POST /api/coaching/modules/:id/approve` (requireAdmin) → set `status:'approved'`,
    `reviewedById: req.user.id`.

- [ ] **Step 1: Write the failing visibility test**

```typescript
// backend/src/routes/coaching.visibility.test.ts — student gets 404 for a draft, 200 after approve
// Use the existing supertest + test-db harness (copy setup from an existing *.test.ts route test).
// Seed: a workspace, an admin, a student, a math skill, a draft CoachingModule.
it('hides a draft module from students (404) and reveals it once approved', async () => {
  // GET /api/coaching/modules/:id as student  → 404
  // POST /approve as admin
  // GET /api/coaching/modules/:id as student  → 200 with content
});
```

- [ ] **Step 2: Run it → FAIL** (`npm test -w backend -- coaching.visibility`) — route 404s for the
  wrong reason (route missing).
- [ ] **Step 3: Implement `coaching.ts`** (copy `math-worksheets.ts` structure). Generate handler:

```typescript
router.post('/modules/generate', requireAdmin, asyncHandler(async (req, res) => {
  const skillId = Number(req.body?.skillId);
  const skill = await prisma.skill.findFirst({ where: { id: skillId, subject: 'math' } });
  if (!skill) return res.status(400).json({ error: 'Math skill not found' });
  const jobId = createJob('math', req.user!.workspaceId, async () => {
    const gen = await generateCoachingModuleContent({
      name: skill.name, slug: skill.slug, examLevelNotes: skill.examLevelNotes,
    });
    const mod = await prisma.coachingModule.create({
      data: { workspaceId: req.user!.workspaceId, skillId: skill.id, title: gen.title, content: gen.content, status: 'draft' },
    });
    return { moduleId: mod.id, verifierWarnings: gen.verifierWarnings };
  });
  res.status(202).json({ jobId });
}));
```

Visibility handler:

```typescript
router.get('/modules/:id', requireAuth, asyncHandler(async (req, res) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
    include: { skill: { select: { name: true, slug: true, topicId: true } } },
  });
  if (!mod) return res.status(404).json({ error: 'Module not found' });
  if (req.user!.role !== 'admin' && mod.status !== 'approved') {
    return res.status(404).json({ error: 'Module not found' }); // never reveal drafts
  }
  res.json(mod);
}));
```

Add `?skillId` list, `PATCH` (version++ when previously approved), `POST /approve`, and the job
poll. Mount the router in `index.ts`.

- [ ] **Step 4: Run it → PASS**; also `npm test -w backend` stays green.
- [ ] **Step 5: Commit** — `feat(coaching): /api/coaching router with approved-only visibility`

---

### Task 3: Chat `assign_coaching` action tool (with generate-first)

**Files:**
- Modify: `backend/src/services/chat-tools.ts` (add schema to `ACTION_TOOL_SCHEMAS`; add case to
  `executeActionTool`)
- Modify: `backend/src/services/chat.service.ts` system prompt only if needed (mention coaching
  assignment as a confirmable action — one line alongside the existing worksheet/intervention line)
- Test: `backend/src/services/chat-tools.test.ts` (extend)

**Interfaces:**
- Consumes: `generateCoachingModuleContent` (Task 1), `prisma`, `assertStudentInWorkspace`.
- Produces: action tool `assign_coaching` with params
  `{ studentId:int, skillSlug:string, interventionId?:int }`. Executor behaviour:
  1. Resolve the math skill by slug in workspace; assert student in workspace.
  2. Find an `approved` `CoachingModule` for that skill in the workspace.
  3. **If none exists:** generate one (`generateCoachingModuleContent`), save as `draft`, and return
     `{ generatedDraft: true, moduleId, needsApproval: true }` — the module is NOT assigned yet
     (admin must approve first; the confirmation card copy tells them). **This satisfies the §8.2
     "generate draft first" path.**
  4. **If an approved module exists:** upsert a `CoachingAssignment` (`moduleId`, `studentId`,
     `interventionId ?? null`) using the `@@unique([moduleId, studentId])` constraint, and return
     `{ assigned: true, moduleId, assignmentId }`.

- [ ] **Step 1: Write failing tests** — two cases in `chat-tools.test.ts`:
  (a) skill with no approved module → `executeActionTool('assign_coaching', …)` returns
  `{ generatedDraft: true, needsApproval: true }` and creates a draft (stub
  `generateCoachingModuleContent`); (b) skill with an approved module → returns `{ assigned: true }`
  and creates exactly one `CoachingAssignment`; calling twice does not create a duplicate (upsert).
- [ ] **Step 2: Run → FAIL** (`assign_coaching` unknown action tool).
- [ ] **Step 3: Implement** the schema + executor case (upsert via
  `prisma.coachingAssignment.upsert({ where: { moduleId_studentId: { moduleId, studentId } }, … })`).
- [ ] **Step 4: Run → PASS**; `npm test -w backend` green.
- [ ] **Step 5: Commit** — `feat(coaching): assign_coaching chat action tool with generate-first`

---

### Task 4: Frontend coaching API client + types

**Files:**
- Modify: `frontend/src/lib/api.ts` (add `coachingApi` + types)

**Interfaces:**
- Produces:
```typescript
export interface CoachingModule { id: number; skillId: number; title: string; content: string;
  status: 'draft' | 'approved'; version: number; reviewedById: number | null;
  skill?: { name: string; slug: string; topicId: number | null } }
export const coachingApi = {
  startGeneration: (skillId: number) =>
    fetchJSON<{ jobId: string }>('/coaching/modules/generate', { method: 'POST', body: JSON.stringify({ skillId }) }),
  getGenerationJob: (jobId: string) =>
    fetchJSON<GenerationJob<{ moduleId: number; verifierWarnings: string[] }>>(`/coaching/jobs/${jobId}`),
  listForSkill: (skillId: number) => fetchJSON<CoachingModule[]>(`/coaching/modules?skillId=${skillId}`),
  get: (id: number) => fetchJSON<CoachingModule>(`/coaching/modules/${id}`),
  update: (id: number, data: { title?: string; content?: string }) =>
    fetchJSON<CoachingModule>(`/coaching/modules/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  approve: (id: number) => fetchJSON<CoachingModule>(`/coaching/modules/${id}/approve`, { method: 'POST', body: '{}' }),
  // student endpoints added in Task 9
};
```

- [ ] **Step 1:** Add the types + client (no test — exercised by pages/e2e).
- [ ] **Step 2:** `npm run typecheck` clean.
- [ ] **Step 3: Commit** — `feat(coaching): frontend api client for modules`

---

### Task 5: Skills browser "Generate lesson" action

**Files:**
- Modify: `frontend/src/pages/Skills.tsx`

**Interfaces:** Consumes `coachingApi` (Task 4). For each math-skill row, fetch its modules
(`listForSkill`) and render one of: **"Generate lesson"** (none), **"View draft"** (draft exists),
**"Approved ✓ / View"** (approved). Clicking Generate calls `startGeneration`, polls
`getGenerationJob` until `done`, then `navigate('/admin/modules/' + result.moduleId)`.

- [ ] **Step 1:** Implement the per-row control + poll (copy the poll loop from the worksheet
  generate flow in `Admin.tsx`). Keep within brand palette; no gradient buttons.
- [ ] **Step 2:** `npm run typecheck` clean; visual check deferred to Task 7 live screenshot.
- [ ] **Step 3: Commit** — `feat(coaching): generate-lesson action in Skills browser`

---

### Task 6: Module editor page (react-markdown, preview, warnings, approve)

**Files:**
- Modify: `frontend/package.json` (add `react-markdown`), run `npm i -w frontend react-markdown`
- Create: `frontend/src/pages/ModuleEditor.tsx`
- Create: `frontend/src/components/MarkdownView.tsx` (shared read-only renderer — reused by the
  Lesson page in Phase 2b)
- Modify: `frontend/src/App.tsx` (route `/admin/modules/:id` under `RequireAdmin`)
- Modify: `frontend/src/components/Sidebar.tsx` (no new nav item needed — editor is reached from
  Skills; but ensure the admin "Coach" section still gates as today)

**Interfaces:**
- `MarkdownView({ content }: { content: string })` → `<ReactMarkdown>` with default (HTML-off)
  settings, wrapped in a `prose`-style container using brand typography (no raw HTML rendering).
- `ModuleEditor` route param `:id`. On mount: `coachingApi.get(id)`. Renders: editable title input,
  a markdown `<textarea>` bound to content, a live `<MarkdownView>` preview beside it, a
  **⚠ verifier warning banner** (from the generation job result passed via router state, or absent),
  **Save** (`update`) and **Approve** (`approve`, then reflect `status:'approved'`).

- [ ] **Step 1: Write the failing e2e assertion** (folded into Task 7 spec) — for now build the
  page; RED is the Task 7 spec.
- [ ] **Step 2:** Add `react-markdown`; implement `MarkdownView` + `ModuleEditor`; add the route.
  Editor layout is a two-column grid (textarea | preview) that collapses to one column on mobile;
  Approve button uses brand green, Save uses brand blue.
- [ ] **Step 3:** `npm run typecheck` clean.
- [ ] **Step 4: Commit** — `feat(coaching): module editor page with markdown preview + approve`

---

### Task 7: Phase 2a e2e spec + live check

**Files:**
- Create: `e2e/m3c2-coaching-admin.spec.ts`
- Modify: `e2e/helpers/chat-stub.ts` if a coaching-generation stub response is needed (the
  `/coaching/modules/generate` job calls the generation + verifier roles → the stub must return a
  module markdown for gen and a verifier verdict; script a first response with a wrong worked
  example and a verdict flagging it, then a corrected retry — to exercise the warning path or the
  clean path as the spec needs).

**Scenarios (admin storageState):**
- **generate → flag → edit → approve:** admin opens `/skills`, clicks "Generate lesson" on a math
  skill, is taken to the editor, sees rendered markdown; if the stub leaves a warning, the ⚠ banner
  shows; admin edits content, clicks Approve, status shows "Approved".
- **approved-only visibility:** as a student (student storageState), `GET /coaching/modules/:id` of
  a still-draft module returns 404 (API-level check); after approve, 200. (Can assert via
  `request.get` in the spec.)
- **chat generate-first:** via the chat stub, sending a message that triggers `assign_coaching` for
  a skill with no approved module surfaces a confirmation card whose copy offers generating a draft
  first; confirming enqueues generation (assert a draft module now exists for the skill).

- [ ] **Step 1: Run the spec → RED** (features partially wired). Fix wiring until GREEN.
- [ ] **Step 2:** Full `npm run e2e` + `npm test` + `npm run typecheck` all green.
- [ ] **Step 3: Live check** — `npm run dev`; screenshot the editor (rendered markdown + warning
  banner + Approve) and the Skills row states. Review before handover.
- [ ] **Step 4: Commit** — `test(coaching): phase 2a e2e (generate→verify→edit→approve, visibility)`
- [ ] **HANDOVER for Phase 2a sign-off** (mandatory workflow step 5). Do not start Phase 2b until
  the user approves 2a.

---

# Phase 2b — Student experience

Ships after 2a sign-off: students browse a Lessons library, open and complete lessons (lazy
assignment), see learn→practise ordering, and get "Learn the method →" links in review.

### Task 8: Student backend endpoints (library, my assignments, complete w/ lazy upsert)

**Files:**
- Modify: `backend/src/routes/coaching.ts`
- Test: `backend/src/routes/coaching.student.test.ts`

**Interfaces (all requireAuth, student-usable):**
- `GET /api/coaching/modules?approved=1` (no `skillId`) → all `approved` modules in the workspace
  with `skill { name, slug, topicId }`, for grouping by topic. Admins may also call it.
- `GET /api/coaching/assignments/me` → the caller's `CoachingAssignment` rows joined to their module
  summary (`id, title, skillId, status`) + `completedAt` + `interventionId`.
- `POST /api/coaching/modules/:id/complete` → **lazy upsert** the caller's assignment then set
  `completedAt`:

```typescript
router.post('/modules/:id/complete', requireAuth, asyncHandler(async (req, res) => {
  const mod = await prisma.coachingModule.findFirst({
    where: { id: Number(req.params.id), workspaceId: req.user!.workspaceId },
  });
  if (!mod || mod.status !== 'approved') return res.status(404).json({ error: 'Module not found' });
  const assignment = await prisma.coachingAssignment.upsert({
    where: { moduleId_studentId: { moduleId: mod.id, studentId: req.user!.id } },
    update: { completedAt: new Date() },
    create: { moduleId: mod.id, studentId: req.user!.id, completedAt: new Date() }, // interventionId null
  });
  res.json(assignment);
}));
```

- [ ] **Step 1: Write failing tests** — (a) student `GET /assignments/me` empty initially;
  (b) `POST /modules/:id/complete` on an approved module the student was never assigned creates an
  assignment with `completedAt` set (lazy); (c) `POST .../complete` on a draft → 404;
  (d) `GET /modules?approved=1` returns approved only, never drafts.
- [ ] **Step 2: Run → FAIL.**
- [ ] **Step 3: Implement** the three handlers.
- [ ] **Step 4: Run → PASS**; `npm test -w backend` green.
- [ ] **Step 5: Commit** — `feat(coaching): student library, my-assignments, complete (lazy assign)`

---

### Task 9: Frontend student coaching API client

**Files:** Modify `frontend/src/lib/api.ts`.

**Interfaces:** extend `coachingApi`:
```typescript
listApproved: () => fetchJSON<CoachingModule[]>('/coaching/modules?approved=1'),
myAssignments: () => fetchJSON<CoachingAssignmentSummary[]>('/coaching/assignments/me'),
complete: (moduleId: number) =>
  fetchJSON<{ completedAt: string }>(`/coaching/modules/${moduleId}/complete`, { method: 'POST', body: '{}' }),
```
with `interface CoachingAssignmentSummary { id: number; moduleId: number; title: string; skillId: number;
completedAt: string | null; interventionId: number | null }`.

- [ ] **Step 1:** Add client + types. **Step 2:** `npm run typecheck` clean. **Step 3: Commit** —
  `feat(coaching): student api client`

---

### Task 10: Lessons library page (student nav)

**Files:**
- Create: `frontend/src/pages/Lessons.tsx`
- Modify: `frontend/src/App.tsx` (route `/lessons`, requireAuth — NOT admin-gated)
- Modify: `frontend/src/components/Sidebar.tsx` (add a "Lessons" nav item visible to students)

**Interfaces:** Consumes `coachingApi.listApproved` + `mathApi.getTopics` (for topic grouping).
Renders approved modules grouped by topic → skill; each row links to `/lesson/:moduleId`. Empty
state ("No lessons yet — your coach will add some"). Brand palette; calm layout.

- [ ] **Step 1:** Implement (group by `skill.topicId`; reuse topic names from `getTopics`).
- [ ] **Step 2:** `npm run typecheck` clean.
- [ ] **Step 3: Commit** — `feat(coaching): student Lessons library page + nav`

---

### Task 11: Lesson page (render + mark complete)

**Files:**
- Create: `frontend/src/pages/Lesson.tsx`
- Modify: `frontend/src/App.tsx` (route `/lesson/:id`, requireAuth)

**Interfaces:** Consumes `coachingApi.get(id)` + `coachingApi.complete(id)` + reuse
`MarkdownView` (Task 6). Renders the module title + `<MarkdownView content>` in a calm single
column (max-width readable measure), and a **Mark as complete** button (brand green) that calls
`complete` and then shows a "Completed ✓" state. A student opening a draft id gets the API 404 →
show a friendly "This lesson isn't available yet" message.

- [ ] **Step 1:** Implement. **Step 2:** `npm run typecheck` clean. **Step 3: Commit** —
  `feat(coaching): student Lesson page with mark-complete`

---

### Task 12: Learn → practise ordering in the pending list

**Files:**
- Modify: `frontend/src/components/PendingWorksheets.tsx` (student mode) and/or
  `frontend/src/components/Sidebar.tsx` "Up next" card — whichever surfaces pending items to
  students. Add incomplete assigned lessons as **"Learn: <title>"** cards ordered **before** their
  paired "Practise" worksheet (pair by shared `interventionId`); the paired worksheet shows a soft
  **"best after the lesson"** hint when its intervention has an incomplete lesson. Never hard-lock
  the worksheet.

**Interfaces:** Consumes `coachingApi.myAssignments`; join to pending worksheets by
`interventionId` (worksheets already carry their intervention linkage via the worksheet/assignment
data the pending list uses — reuse whatever `PendingWorksheets` already loads; if the intervention
id is not present on the worksheet payload, thread it through the existing pending endpoint).

- [ ] **Step 1: Write failing e2e assertion** (folded into Task 14) — Learn card precedes Practise
  card; hint present; worksheet still clickable.
- [ ] **Step 2:** Implement the ordering + hint. Soft only.
- [ ] **Step 3:** `npm run typecheck` clean.
- [ ] **Step 4: Commit** — `feat(coaching): learn→practise ordering in pending list`

---

### Task 13: Post-test review weaving ("Learn the method →")

**Files:**
- Modify: `frontend/src/pages/MathAttemptReview.tsx`

**Interfaces:** For each reviewed question, show its **skill chip** (skill name — the question rows
already carry skill info via `MathQuestionFull`/attempt details; if the review payload lacks
`skill`, add it to the questions the review endpoint returns). For a **wrong** answer whose skill
has an **approved** module, render a **"Learn the method →"** link to `/lesson/:moduleId`. Resolve
"has approved module for skill" via a small lookup: call `coachingApi.listApproved()` once on mount
and map `skillId → moduleId`. No link when no approved module exists for that skill.

- [ ] **Step 1: Write failing e2e assertion** (folded into Task 14) — wrong answer with an approved
  module shows the link; wrong answer without one does not.
- [ ] **Step 2:** Implement chip + conditional link.
- [ ] **Step 3:** `npm run typecheck` clean.
- [ ] **Step 4: Commit** — `feat(coaching): post-test review 'Learn the method' weaving`

---

### Task 14: Phase 2b e2e specs + end-to-end loop + live check

**Files:**
- Create: `e2e/m3c2-coaching-student.spec.ts`
- Create: `e2e/m3c2-coaching-loop.spec.ts` (the success-criterion end-to-end loop)

**Scenarios:**
- **Lessons library + lazy complete:** seed an approved module (API). Student opens `/lessons`,
  sees it grouped by topic, opens `/lesson/:id`, clicks "Mark as complete" → completed state; a
  follow-up `GET /assignments/me` shows the lazily-created, completed assignment.
- **Review weaving:** seed an approved module for skill A and none for skill B; a math attempt with
  a wrong answer on each → the skill-A question shows "Learn the method →", skill-B does not.
- **Learn→practise ordering:** seed an intervention with an assigned (incomplete) lesson + a paired
  worksheet → the Learn card renders before the Practise card with the soft hint; the worksheet is
  still startable.
- **End-to-end loop (`m3c2-coaching-loop.spec.ts`):** seeded data — diagnose (opportunity area) →
  intervene (chat assign_coaching → approved module + worksheet) → student learns the lesson +
  practises the worksheet → improvement visible in the admin Improvement Journey. Reuse M3b chat
  stub + M3c-1 seeding helpers.

- [ ] **Step 1: Run specs → RED**, fix wiring → GREEN.
- [ ] **Step 2:** Full `npm run e2e` + `npm test` + `npm run typecheck` all green.
- [ ] **Step 3: Live check** — `npm run dev`; screenshot `/lessons`, a `/lesson/:id`, the pending
  list ordering, and a review with the "Learn the method →" link.
- [ ] **Step 4: Commit** — `test(coaching): phase 2b e2e + end-to-end coaching loop`
- [ ] **HANDOVER for Phase 2b sign-off** (mandatory workflow step 5).

---

## Self-review (author checklist — completed)

- **Spec coverage:** §3.1 gen+verify+retry → Task 1; §3.2 triggers → Tasks 3 (chat) + 5 (Skills);
  §3.3 editor → Task 6; §3.4 visibility → Task 2; §4.1 assignment paths → Tasks 3 + 8; §4.2 library
  → Tasks 8+10; §4.3 lesson page → Tasks 8+11; §4.4 ordering → Task 12; §4.5 review weaving →
  Task 13; §5 API → Tasks 2+8; §6 tests → Tasks 7+14; §7 success criteria → Task 14 loop. All
  covered.
- **Type consistency:** `coachingApi` names (`startGeneration`/`getGenerationJob`/`get`/`update`/
  `approve`/`listApproved`/`myAssignments`/`complete`) are used consistently across Tasks 4/5/6/9/
  10/11/13. Route paths match between §5, Task 2, and Task 8. The lazy-upsert uses the same
  `moduleId_studentId` compound-unique in Tasks 3 and 8.
- **Placeholder scan:** the only intentionally-unwritten literals are the **AI prompt strings**
  (Task 1), which §11 mandates be authored by the capable implementing model, not pre-written by a
  weaker one — the plan specifies their exact required content/structure and the control flow + unit
  tests around them, which is the correct level of specification for judgment work.
