# Milestone 2 — Multi-user, multi-tenant workspaces

Approved 2026-07-18. Tracked as worklog items **W-9…W-14**; each phase runs the mandatory
5-step workflow (CLAUDE.md) internally, and any scope change comes back for re-approval.

## Goal

A **Workspace** is the top-level tenant container. Each workspace has multiple **admins**
— they generate worksheets, assign them to students, and see every student's performance
in their workspace — and multiple **students**, who see only their own performance,
opportunity areas, and assigned worksheets. All pre-milestone data moves into a **Demo
workspace** owned by a demo admin and demo student; outside it, the slate is clean.

## Product decisions (user-confirmed 2026-07-18)

1. **Auth:** password login now, implemented behind a swappable identity-provider
   interface so a third-party IdP (e.g. Auth0/OIDC) can replace it without touching
   routes or UI.
2. **Membership:** one workspace per user, one role (`admin` | `student`).
3. **Assignment:** admins pick students at worksheet save (with select-all); pending is
   tracked per student.
4. **Curriculum:** writing types, math topics and seeded question banks stay
   shared/global. Only attempts, analyses, worksheets and assignments are tenant-scoped
   (worksheet-generated questions/prompts are scoped through their worksheet).

## Architecture

### Schema (one migration + data backfill)

- `Workspace { id, name, slug @unique, isDemo }`
- `User { id, workspaceId, role, name, email @unique, authProvider @default("local"),
  providerSubject?, passwordHash?, isDemo }` — `authProvider`/`providerSubject`/
  `passwordHash` are the IdP seam: an OIDC user is `('oidc', <sub>, null)`.
- `Attempt` / `MathAttempt` + required `userId` (workspace derives via the user).
- `Worksheet` / `MathWorksheet` + required `workspaceId`, `createdById`.
- New `WorksheetAssignment` / `MathWorksheetAssignment { worksheetId, studentId,
  @@unique([worksheetId, studentId]) }` — pending = assignment with no attempt by that
  student.
- **Backfill (hand-edited migration SQL):** create the Demo workspace, demo admin
  `demo-admin@demo.local` and demo student `demo-student@demo.local` (documented default
  passwords, bcrypt-hashed); every existing attempt → demo student; every worksheet →
  Demo workspace, assigned to the demo student. Fresh installs get no demo rows — the
  first-run setup screen creates the first workspace + admin.

### Auth — swappable by construction

- `backend/src/services/auth/identity-provider.ts` defines the interface
  (`verifyCredentials(email, password)` → normalized identity or null). Routes and
  middleware depend only on the interface; `local-provider.ts` implements it with
  bcryptjs. **Auth0 swap procedure:** add an OIDC provider file that maps the IdP `sub`
  to `User.providerSubject` (provisioning new users into their workspace), wire the login
  redirect — session, middleware, and every domain route stay untouched.
- Session: signed HTTP-only cookie (`cookie-session`, `SESSION_SECRET` from `.env` with a
  local dev default) holding `{ userId }`. `requireAuth` loads `req.user`; `requireAdmin`
  guards role.
- Routes: `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` ·
  `GET/POST /api/workspace/users` (admin manages own-workspace members) ·
  `POST /api/setup` (first-run only, when zero users exist).

### Scoping contract (fixed in Phase A; parallel tracks build against it)

- **Student:** every attempt/heatmap/stats/history route implicitly filters to
  `req.user`; worksheet lists = their assignments.
- **Admin:** the same routes accept `?studentId=` (must be in the admin's workspace, else
  403); worksheet save takes `studentIds[]` and creates assignments; admin lists cover
  their workspace only.
- Any cross-workspace access → 403/404. Negative paths are e2e-proven (see B1/C2).

### Frontend

Login page + auth context (`GET /api/auth/me` bootstrap) + route guard. Students get
today's app scoped to themselves. Admins additionally get: student selector on
heatmaps/history, assignment picker in both worksheet save flows, and a workspace-members
panel. Sidebar shows the current user + workspace; momentum is per-student.

## Phases (W-9…W-14) — parallel where possible, rigorous everywhere

The suite must be green at every phase boundary. Parallel tracks run in separate git
worktrees against the Phase-A contract and merge only with their proving specs green.

| Item | Phase | Mode | Scope |
|---|---|---|---|
| W-9 | **A — Foundation** | serial | Schema + migration + backfill; auth service/session/middleware; setup flow; seed adds e2e/demo users; e2e harness upgrade (login helpers, Playwright `storageState` fixtures for admin/student); all 54 existing specs authenticated and green again. |
| W-10 | **B1 — Backend scoping** | parallel with B2 | `requireAuth` + scoping contract on every route; authz e2e (student ↛ other student, student ↛ admin APIs, admin ↛ other workspace). |
| W-11 | **B2 — Frontend auth shell** | parallel with B1 | Login/logout/first-run screens, auth context + guards, sidebar identity, student app scoped to self. |
| W-12 | **C1 — Admin experience** | parallel with C2 | Assignment picker at save, per-student performance views, workspace-members management. |
| W-13 | **C2 — Student experience** | parallel with C1 | Assigned-pending lists everywhere (dashboard, sidebar Up-next, type/topic pages), opportunity areas, negative-path e2e hardening. |
| W-14 | **D — Integration** | serial | Full suites + typecheck; live multi-user walkthrough on a fresh DB (setup → add students → assign → student completes → admin reviews) and demo-workspace verification; migration dry-run against a copy of dev.db; README + CLAUDE.md updates (the "no login" line changes). |

## Final success criteria (Phase D exit — the milestone's definition of done)

1. Fresh install: setup screen → workspace + admin → add students → generate & assign →
   student logs in and sees only their assignments/performance → admin sees every
   student's performance.
2. The Demo workspace contains 100% of pre-migration data owned by the demo student;
   outside it the slate is clean.
3. Authorization proven by e2e: no student reads another student's data or reaches admin
   APIs; no admin reaches outside their workspace.
4. Auth is confined to the identity-provider interface; the Auth0 swap procedure is
   documented and requires no route/UI changes.
5. All suites green (expanded e2e, unit, `npm run typecheck`); live screenshots of login,
   admin, and student views reviewed; user sign-off per item.
