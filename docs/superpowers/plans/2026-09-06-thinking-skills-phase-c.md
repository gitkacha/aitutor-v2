# Thinking Skills — Phase C (Coaching lessons) Implementation Plan

> Execute inline (superpowers:executing-plans). RED-first per task. Branch `thinking-skills-phase-c`.

**Goal:** Bring the M3c coaching pipeline (generate → verify → admin approve → student sees it) to
Thinking Skills, at Mathematics parity. Completes full TS parity.

**Architecture:** The lesson structure (The idea / Step by step / Speed technique / Worked examples /
Traps to avoid) is subject-agnostic and reused. The coaching generator is subject-parametrized; the
arithmetic verifier is math-only (reasoning lessons have no arithmetic to check — admin review is the
gate, matching the existing fails-open design). Student surfacing is already generic (by
`skill.topicId`), so C4 mostly proves the loop.

## Global Constraints

- `subject` defaults to `'math'` everywhere → Mathematics coaching byte-for-byte unchanged; Writing
  untouched.
- RED-first; full `npm run e2e` + `npm test` + typecheck before handover; per-item sign-off.
- TS coaching draft is never shown to a student until an admin approves it (existing rule).

---

### Task C1 (W-110): Subject-aware coaching generation (backend service)

**Files:** `backend/src/services/coaching.service.ts`; test
`backend/src/services/coaching.service.test.ts` (extend).

- `generateCoachingModuleContent(skill, subject: 'math' | 'thinking-skills' = 'math')`.
- `generationPrompt(skill, subject, feedback?)` — the math branch returns the CURRENT string
  verbatim; the `thinking-skills` branch reframes "teaches ONE maths skill" → "teaches ONE
  thinking-skills reasoning skill" and frames the worked examples as worked reasoning problems
  (speed-technique/traps wording already generic).
- Verification is subject-gated: `generateCoachingModuleContent` runs `verifyWorkedExamples` (the
  arithmetic checker) only for `math`; for `thinking-skills` it skips it (no warnings, no retry).
- **Tests:** (a) math prompt unchanged (a snapshot/contains assertion pinning "ONE maths skill");
  (b) TS prompt contains reasoning language and NOT "maths skill"; (c) for TS, the verifier is not
  called (control-flow — mock the verification model / spy).

### Task C2 (W-111): Coaching routes + coach chat accept thinking-skills

**Files:** `backend/src/routes/coaching.ts`, `backend/src/services/chat-tools.ts`; e2e
`e2e/tsC-coaching-generate.spec.ts`.

- `POST /coaching/modules/generate`: resolve the skill as math OR thinking-skills (drop the
  `subject:'math'` filter → `findFirst({ id })` then derive subject from the skill), pass the
  derived subject into `generateCoachingModuleContent`.
- `assign_coaching`: resolve math or thinking-skills skill, pass subject; generalise the "math skill"
  copy to "a skill".
- **e2e (admin, model stubbed):** generate a lesson for a TS skill (e.g. `visual-reasoning`) → a
  draft `CoachingModule` is created for that skill.

### Task C3 (W-112): Admin authoring UI for Thinking Skills lessons

**Files:** `frontend/src/pages/Skills.tsx`; e2e `e2e/tsC-skills-lesson-action.spec.ts`.

- `lessonAction(skill)`: allow `subject === 'thinking-skills'` too (drop `!== 'math'` gate) so TS
  skills show **Generate lesson / View draft**. ModuleEditor approve flow is already generic.
- **e2e:** on `/skills`, a TS skill shows a "Generate lesson" button; generating (stubbed) produces a
  draft reachable via the Lessons index / the button flips to "View draft".

### Task C4 (W-113): End-to-end student loop for Thinking Skills

**Files:** verify `frontend/src/pages/MathPracticeHome.tsx` (lessons by `skill.topicId`),
`Lesson.tsx`, `AdminLessons.tsx` — fix any subject gate found; e2e
`e2e/tsC-student-loop.spec.ts`.

- **e2e:** generate → approve a TS lesson (via API), then as the student the lesson appears on that
  TS **section practice page** (`/math/<ts-slug>`) under "Lessons" and opens in the Lesson viewer.

## Verification

Per task RED→GREEN, then full suites + typecheck. Live check: the Skills lesson action on a TS skill
and an approved TS lesson on its section page. Hand over for sign-off; tick each W-item after
approval. This closes full Mathematics parity for Thinking Skills.
