# Milestone 3c Phase 2 — Coaching library + student lessons (design)

**Status:** Approved design (brainstormed and approved section-by-section with the user,
2026-07-25).
**Refines:** §8 of `docs/superpowers/specs/2026-07-24-milestone3-agentic-coach-design.md`
(the higher-level M3c coaching design, already approved). This document locks the open decisions
in §8 into implementation-ready choices for Phase 2.
**Depends on:** M3a (skill taxonomy, `examLevelNotes`, misconception fingerprints, Skills
browser), M3b (chat agent, `pending-actions` gate, `Intervention` ledger), M3c-1 (Encouragement)
— all complete and signed off.

---

## 0. Non-negotiables (carried from the parent spec)

- **Answer-key hygiene (§0.6 of parent):** every student-reachable response is checked against the
  answer-key rule. Module content is *teaching text* (worked examples with their answers is
  teaching, not a worksheet answer key) — but generation and verifier prompts must never embed a
  live worksheet's answer key, and student endpoints never return a module that is not `approved`.
- **Cost vs accuracy (§11 of parent):** generation and verifier *prompts* are judgment work and are
  **not** delegated to a weaker coding model. Routes, Prisma plumbing, UI components, and e2e specs
  whose scenarios are spelled out here are safe for cheaper models, verified by the mandatory full
  `npm run e2e` + `npm test` + `npm run typecheck` gates.
- **Mandatory 5-step workflow (`CLAUDE.md`)** applies to every work item: plan → approval → worklog
  items → implement RED-first → full suites green → user manual sign-off before ticking.
- **Look and feel:** brand blue/green/amber + navy sidebar; no gradients, no purple, no
  single-accent-border cards. The student Lesson page especially stays calm and uncluttered.

## 1. Scope

Two independently-shippable sub-phases, with user sign-off between them. **Math skills only** this
milestone; writing modules are a later follow-up (identical pipeline keyed to the 7 writing skills).

- **Phase 2a — Admin: author a lesson.** Generate → verify → edit → approve. Nothing student-facing.
- **Phase 2b — Student: reach & complete a lesson.** Lessons library, lesson page, pending-list
  learn→practise ordering, post-test review weaving.

### Out of scope (this milestone)

- Writing coaching modules (later follow-up; the pipeline is designed to key off any `Skill`).
- A standalone admin "assign module to student" picker (YAGNI — assignment happens via
  intervention/chat and via student self-serve lazy assignment; see §4.1).
- Rich-text / WYSIWYG module editing (raw markdown + live preview only).

## 2. Data model

**No schema changes.** `CoachingModule` and `CoachingAssignment` already exist in §2 of the parent
spec exactly as needed:

- `CoachingModule` — `workspaceId, skillId, title, content (markdown, §8.1 structure),
  status ('draft'|'approved'), reviewedById?, version (default 1)`.
- `CoachingAssignment` — `moduleId, studentId, interventionId?, completedAt?` with
  `@@unique([moduleId, studentId])`.

`interventionId` being nullable is what enables self-directed (non-intervention) assignments. The
unique constraint makes lazy assignment a safe upsert (§4.1).

One transient store is added in the backend for generation progress, mirroring
`generation-jobs.ts` (§3.1) — an in-memory job map, not a table.

## 3. Phase 2a — admin authoring

### 3.1 Generation pipeline (background job)

Generation is a **background job**, mirroring `backend/src/services/generation-jobs.ts` (worksheet
generation), because it is multi-call and slow (2–3 model calls). The Skills-browser trigger and the
chat trigger both enqueue the same job; the client polls for status.

Steps, in order:

1. **Generate.** `generation` role (default `gpt-5-mini`, via `providerFor('generation')`). The
   prompt is anchored on the skill's `examLevelNotes` and, where available, its misconception
   fingerprints (from the analytics taxonomy). It must produce the §8.1 markdown structure in the
   §8.1 student voice:
   `## The idea` → `## Step by step` → `## Speed technique` (omit if none applies) →
   `## Worked examples` (2–3) → `## Traps to avoid`.
   **Engagement requirement (§8.1):** written for the 11-year-old — direct "you", short sentences,
   concrete relatable examples, speed techniques framed as tricks worth showing off, traps framed as
   "gotchas the test setters hope you fall for". No babyish tone, no walls of text; reads in under
   5 minutes. (The taxonomy's `examLevelNotes` stay tutor-voiced; only the module content takes the
   student voice.)
2. **Verify.** `verification` role (default `o4-mini` reasoning auditor, via
   `providerFor('verification')`) checks the arithmetic of **each worked example**. Returns per-example
   pass/fail with a short reason on failure.
3. **One auto-retry.** If the verifier flags any example, regenerate **once** with the verifier's
   findings appended to the prompt. If the retry still fails, save the draft anyway and attach the
   verifier warnings to it (surfaced in the editor, §3.3).

The generation and verifier prompts are **judgment work** — authored by a capable model, never
delegated to a weaker one (§11).

The saved artifact is always a `CoachingModule` with `status:'draft'`, `version:1`. Verifier
warnings from a failed final pass are returned to the client (job result) and shown in the editor;
they are not persisted as a schema field (transient, like job state).

### 3.2 Triggers

- **Skills browser button.** Each math-skill row in `frontend/src/pages/Skills.tsx` gains a
  **"Generate lesson"** action. If the skill already has a module, the row instead links to it
  ("View lesson" / shows draft/approved status). Clicking Generate enqueues the job and navigates to
  the module editor, which shows the generating state then the draft.
- **Chat `assign_coaching` action tool.** Extends the M3b chat agent: when the admin asks to assign
  coaching for a skill that has **no approved module**, the confirmation card offers
  **"generate draft first"**. Confirming enqueues the same generation job through the existing
  `pending-actions` gate + executor. (Assigning coaching for a skill that already has an approved
  module proceeds straight to a `CoachingAssignment` — see §4.1.) This is the only M3b-chat surface
  touched in this milestone.

### 3.3 Module editor

`frontend/src/pages/ModuleEditor.tsx`, admin-only via the `RequireAdmin` route guard (App.tsx) and
a `user?.role === 'admin'` sidebar gate — same pattern as the W-57 admin lockdown.

- **Live markdown preview** using **react-markdown** (new dependency; popular and well-supported per
  CLAUDE.md's library guidance). react-markdown does not render raw HTML by default, so module
  content cannot inject markup — no extra sanitizer needed.
- Editable **title** and **content** (raw markdown textarea + preview pane).
- A **⚠ verifier-warning banner** when the generation job returned unresolved arithmetic flags,
  listing which worked example failed and why, for the admin to fix before approving.
- **Approve** button → `PATCH`/`POST` sets `status:'approved'` and `reviewedById` (current admin).
  Editing an already-approved module bumps `version` (`version++`).
- Loading state while the generation job runs (poll), then renders the draft.

### 3.4 Visibility & approval invariants

- Only `approved` modules are assignable or visible to students (§8.2). Enforced at the route layer:
  a student requesting a `draft` module by id gets **404** (not 403 — do not reveal existence).
- Admins see drafts and approved modules for their workspace.
- All module rows are workspace-scoped (`workspaceId`), like every other tenant-scoped model.

## 4. Phase 2b — student experience

### 4.1 Assignment paths

Two ways a `CoachingAssignment` comes to exist — **no standalone admin picker**:

1. **Intervention / chat.** The `assign_coaching` action tool (§3.2) creates a `CoachingAssignment`
   linked to the intervention (`interventionId` set) for the target student when an approved module
   exists (or after generating+approving one).
2. **Student self-serve (lazy assignment).** When a student opens an **approved** module for which
   they have no existing assignment (via the Lessons library or a review "Learn the method →" link),
   the backend **lazily creates** a `CoachingAssignment` for them with `interventionId: null`. This
   is an upsert on the `@@unique([moduleId, studentId])` constraint, so it is idempotent and safe
   under repeated opens. Lazy assignment gives completion a home (`completedAt`) and lets admins see
   self-directed engagement.

### 4.2 Lessons library

`frontend/src/pages/Lessons.tsx` — a new **student** nav item ("Lessons"). Lists all **approved**
modules in the workspace, grouped by topic → skill, each openable anytime. This satisfies the user's
intent that students can learn a method *before* being tested on it, not only in response to a wrong
answer. Approved-only; drafts never appear. Reuses the topic grouping already used by the Skills
browser / heatmap.

### 4.3 Lesson page

`frontend/src/pages/Lesson.tsx` — opened by module id.

- Rendered markdown (react-markdown), **calm uncluttered layout** (the look-and-feel bar is highest
  here — a nervous 11-year-old reads this).
- **Mark as complete** → sets `completedAt` on the student's assignment (lazily creating it first if
  needed, §4.1).
- Server enforces approved-only visibility (draft → 404 for students).

### 4.4 Pending-list ordering (learn → practise)

In the student pending list, an assigned **"Learn: <title>"** card appears **before** its paired
"Practise" worksheet card. The paired worksheet shows a soft **"best after the lesson"** hint when
its intervention has an incomplete lesson. **Soft ordering only** — the worksheet is never
hard-locked; a student may always practise first. Pairing is via the shared `interventionId`.

### 4.5 Post-test review weaving

In the math attempt review (`MathAttemptReview`), each question shows its **skill chip**. A wrong
answer whose skill has an **approved** module gets a **"Learn the method →"** link to that module's
lesson page. The link presence is driven by approved-module existence for the skill (not by whether
the student was already assigned it) — opening it triggers lazy assignment (§4.1).

## 5. API surface

New router `backend/src/routes/coaching.ts`, mounted under `/api/coaching`, structured like
`math-worksheets.ts`. All routes are workspace-scoped and behind `requireAuth`; admin-only routes
add `requireAdmin`.

**Admin (requireAdmin):**

- `POST /api/coaching/modules/generate` `{ skillId }` → enqueues the generation job; returns a job id.
- `GET  /api/coaching/jobs/:jobId` → generation job status/result (mirrors worksheet job polling).
- `GET  /api/coaching/modules?skillId=` → modules for a skill (admin: draft + approved).
- `PATCH /api/coaching/modules/:id` `{ title?, content? }` → edit; if module was `approved`, `version++`.
- `POST /api/coaching/modules/:id/approve` → `status:'approved'`, `reviewedById`.

**Shared / student (requireAuth):**

- `GET  /api/coaching/modules/:id` → the module. Admins get any in their workspace; **students only
  if `approved`, else 404.**
- `GET  /api/coaching/modules?approved=1` → student Lessons library: approved modules for the
  workspace, grouped/orderable by topic → skill.
- `GET  /api/coaching/assignments/me` → the caller's assignments (module summary + `completedAt`),
  for the pending list.
- `POST /api/coaching/modules/:id/complete` → student marks complete; **lazily upserts** the
  assignment (interventionId null) if none exists, then sets `completedAt`. 404 if the module is not
  approved.

`assign_coaching` (chat action tool) creates intervention-linked assignments through the M3b
executor, not a public REST route.

## 6. Testing strategy (RED-first, per the mandatory workflow)

Isolated e2e stack only (fresh `e2e.db`, ports 3105/5273, OpenAI stub on 3106 via
`e2e/helpers/chat-stub.ts`). New Playwright specs — each RED first, then GREEN, then full suite:

- **2a generation + approval** — admin clicks "Generate lesson" (stub returns a module with a
  deliberately wrong worked example) → verifier flag surfaces in the editor → admin edits → Approve →
  status shows approved.
- **2a approved-only visibility** — a student requesting a draft module id gets 404; after approval,
  the same id returns content.
- **2a chat generate-first** — via the chat stub, `assign_coaching` for a skill with no approved
  module offers "generate draft first"; confirming enqueues generation.
- **2b Lessons library** — student opens `/lessons`, sees approved modules grouped by topic, opens
  one.
- **2b lazy assignment + complete** — student opens an unassigned approved module (via library and
  via a review link) → assignment is created → "Mark as complete" sets completion → admin sees it.
- **2b learn→practise ordering** — assigned Learn card renders before its paired Practise card with
  the soft hint; worksheet is not hard-locked.
- **2b review weaving** — a wrong answer whose skill has an approved module shows "Learn the
  method →"; a wrong answer whose skill has no approved module does not.
- **End-to-end loop (success criterion)** — one spec on seeded data: diagnose → intervene → lesson +
  worksheet assigned → student learns + practises → improvement visible.

Unit tests: the generation/verifier orchestration (retry-once-then-flag control flow) gets a unit
test with the AI calls stubbed, asserting the retry fires exactly once on a flagged example and the
warning is attached on a still-failing final pass. Backend route auth/visibility gets unit or e2e
coverage (draft→404 for student).

## 7. Success criteria

**Phase 2a:** an admin generates a lesson for a math skill from the Skills browser and from chat;
the verifier's arithmetic check runs with one retry; the draft opens in the editor with any warnings;
Approve makes it `approved`; students cannot see drafts (404).

**Phase 2b:** approved-only visibility enforced; a student browses the Lessons library and opens a
lesson before any related test; opening an unassigned approved module lazily creates an assignment;
"Mark as complete" tracks completion and the admin sees it; assigned Learn cards order before their
paired Practise cards (soft); post-test review shows "Learn the method →" only where an approved
module exists; and the full loop (diagnose → intervene → lesson + worksheet → improvement visible) is
demonstrated end-to-end on seeded data.

## 8. Guidance for implementing agents

- **Judgment work, not delegated to weaker models:** the generation prompt (§3.1 step 1) and the
  verifier prompt/integration (§3.1 step 2). Author these with a capable model.
- **Safe for cheaper models with tests in hand:** the coaching router (§5), Prisma plumbing, the
  generation-job scaffolding (copy `generation-jobs.ts`), the editor/library/lesson UI, and every
  e2e spec whose scenario is spelled out in §6.
- Imitate existing patterns: routes copy `math-worksheets.ts`; the job copies `generation-jobs.ts`;
  AI role config uses the existing `providerFor(role)` seam; admin pages copy existing admin pages;
  the pending-list/review changes extend existing student components.
- Never put statistics logic anywhere except `analytics.service.ts` (unchanged here — this milestone
  adds no new statistic).
- Every student-reachable response is checked against the answer-key rule (§0).
