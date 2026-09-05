# Thinking Skills — Phase B (Skill Analytics parity) Implementation Plan

> Execute inline (superpowers:executing-plans). RED-first per task. Continues branch
> `thinking-skills-phase-a`.

**Goal:** Bring Thinking Skills to Mathematics parity for M3a skill analytics — per-skill reports,
opportunity areas, trend, and "most improved" — and fix the latent leak where TS skill signals bleed
into the "math" report.

**Architecture:** The pure stats core (`analytics-core.ts`) is subject-agnostic and unchanged. All
work is in the DB adapter (`analytics.service.ts`), the routes/chat tools, and the UI. The adapter
becomes subject-aware: it filters answer records to the requested subject and windows a student's
attempts by subject.

## Global Constraints

- `subject` defaults to `'math'` everywhere → no Mathematics behaviour change except that TS skills
  no longer leak into the math report. Writing analytics untouched.
- Attempts are subject-homogeneous (single-topic, all-topics=math, worksheets reject mixed
  subjects), so an attempt's subject = the subject of its questions' topics.
- RED-first; full `npm run e2e` + `npm test` + typecheck before handover; per-item sign-off.

---

### Task B1 (W-105): Subject-aware analytics adapter + leakage fix

**Files:** `backend/src/services/analytics.service.ts`; test
`backend/src/__tests__/analytics-subject.test.ts`.

- `buildMathRecords(attempts, subject='math')`: only emit AnswerRecords for questions whose
  `skill.subject === subject` (no-skill questions still counted as `untaggedQuestions`;
  other-subject questions are simply skipped).
- `buildMathWindow(studentId, lastNTests, subject='math')`: tag each of the student's attempts with
  its subject (via its questions' `topic.subject`), keep only `subject` attempts, then take the last
  N — so a subject report windows that subject's tests, not a mixed set.
- Thread `subject` through `computeMathSignalsForStudent`, `getSkillSignalsSince` (default `math`),
  `getSkillTrend` (default `math`), and the cohort loop.
- `getStudentSkillReport(studentId, subject, lastN)` accepts `'math' | 'writing' | 'thinking-skills'`;
  `math`/`thinking-skills` → the subject-scoped MCQ report; `writing` → unchanged.
- `getOpportunityAreas(workspaceId, subject, studentId?)` accepts `'thinking-skills'`; cohort scoped
  to subject.
- `getMathImprovements(studentId, subject='math')` windows by subject.

**Tests:** a student with both math and TS attempts →
- the `math` report contains only math skills (TS leakage gone);
- the `thinking-skills` report contains only TS skills, with signals computed;
- windowing counts only the subject's attempts.

### Task B2 (W-106): Expose thinking-skills through the API + coach chat

**Files:** `backend/src/routes/analytics.ts`, `backend/src/services/chat-tools.ts`; e2e
`e2e/tsB-analytics-report.spec.ts`.

- `parseSubject` accepts `'thinking-skills'`; apply to `report`, `trend`, `opportunity-areas`,
  `me/improvements` (writing unchanged). Update the 400 messages.
- `chat-tools.ts`: `get_student_skill_report` and `get_opportunity_areas` subject enums add
  `'thinking-skills'`.
- **e2e:** create TS + math attempts for a student via API; `GET
  /analytics/students/:id/report?subject=thinking-skills` returns TS skills; `?subject=math`
  excludes them.

### Task B3 (W-107): Admin Skills taxonomy page shows Thinking Skills

**Files:** `frontend/src/pages/Skills.tsx`; e2e `e2e/tsB-skills-taxonomy.spec.ts`.

- Render a **Thinking Skills** group (subject `thinking-skills`) with its sections + skills,
  mirroring the Mathematics groups (read-only).
- **e2e:** `/skills` shows a TS section heading and one of its skills.

### Task B4 (W-108): Student "Most Improved" + trend for Thinking Skills

**Files:** `frontend/src/lib/api.ts` (`improvementsApi.thinkingSkills`, `analyticsApi.skillTrend`
subject), `frontend/src/components/MostImproved.tsx`, `frontend/src/components/SkillTrendChart.tsx`;
e2e `e2e/tsB-most-improved.spec.ts`.

- `improvementsApi.thinkingSkills()` → `/analytics/me/improvements?subject=thinking-skills`;
  `MostImproved` loads math + TS and shows both (TS links `/math/<slug>`).
- `analyticsApi.skillTrend(studentId, slug, subject='math')`; `SkillTrendChart` passes subject.
- **e2e:** a TS section that improved shows in Most Improved.

## Verification

Per task: RED→GREEN, then full `npm run e2e` + `npm test` + `npm run typecheck`. Live check of the
Skills page + Most Improved. Hand over for sign-off; tick each W-item only after approval.
