# Milestone 3a — Measurement Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Skill taxonomy, per-question capture (timing/flags/answer-changes), and a deterministic
analytics service computing the nine diagnostic signals — the foundation for M3b (agentic chat)
and M3c (coaching).

**Architecture:** A pure, DB-free analytics core (`analytics-core.ts`) implements every formula
against plain `AnswerRecord[]` inputs and is proven by hand-computed unit tests written into this
plan verbatim. A thin adapter (`analytics.service.ts`) maps Prisma rows to records. Capture is
instrumented in the existing timed-test page. Skill tags flow from a seeded closed taxonomy.

**Tech Stack:** Existing stack only — Prisma/SQLite, Express, vitest, React, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-24-milestone3-agentic-coach-design.md` (§2–§4, §9–§11).

## Global Constraints

- CLAUDE.md mandatory 5-step workflow applies to every task; worklog items W-31…W-40 map to
  Tasks 1–10 and are ticked only after user sign-off.
- RED first: watch each new test fail before implementing. Full `npm run e2e` + `npm test`
  (frontend and `npm test -w backend`) + `npm run typecheck` green before every commit.
- e2e only against the isolated stack (fresh `e2e.db`, ports 3105/5273, OpenAI stub on 3106).
- No statistics logic anywhere except `analytics-core.ts`. No AI calls in analytics files.
- No new endpoint returns `correctIndex`/`explanation` to students (spec §0.6).
- **Accuracy rule (spec §11):** Tasks 3–5 test vectors below are authoritative. Transcribe them
  exactly; never adjust an expected value to make a test pass — a mismatch means the
  implementation is wrong.
- Exact constants: evidence floor **8**; exam anchor **68 600 ms**; fast-wrong `< 0.6 × M`;
  slow-wrong `> 1.5 × M`; slow label `mean > max(1.5 × M, 68600)`; misconception needs ≥ 4
  answered-wrong and modal share ≥ 0.5; cohort gate ≥ 5 students; trend halves need ≥ 4
  questions per half; default window `N = 10` attempts.
- Unanswered (chosen index `-1`/null) counts as **attempted and incorrect** for accuracy — same
  as real exam scoring. Only *answered* wrong questions feed fast/slow-wrong and misconception.

---

### Task 1: Prisma schema — Skill model and capture columns

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Migration: `backend/prisma/migrations/*_m3a_skills_and_capture/`

**Interfaces:**
- Produces: `Skill` model; `MathQuestion.skillId Int?` + `skill` relation;
  `MathAttempt.questionTimings/questionFlags/answerChanges String?`;
  `Analysis.criteriaScores String?`. All later tasks depend on these names exactly.

- [ ] **Step 1: Edit schema.** Add to `schema.prisma`:

```prisma
model Skill {
  id             Int     @id @default(autoincrement())
  subject        String  // 'math' | 'writing'
  topicId        Int?
  name           String
  slug           String  @unique
  description    String
  examLevelNotes String
  isDemo         Boolean @default(false)
  topic          MathTopic?     @relation(fields: [topicId], references: [id])
  questions      MathQuestion[]
}
```

On `MathTopic` add `skills Skill[]`. On `MathQuestion` add:
`skillId Int?` and `skill Skill? @relation(fields: [skillId], references: [id])`.
On `MathAttempt` add: `questionTimings String?`, `questionFlags String?`, `answerChanges String?`.
On `Analysis` add: `criteriaScores String?`.

- [ ] **Step 2: Migrate + regenerate.**
Run: `cd backend && npx prisma migrate dev --name m3a_skills_and_capture`
Expected: migration applied to dev.db, client regenerated.
- [ ] **Step 3: Typecheck.** Run: `npm run typecheck` (repo root). Expected: clean.
- [ ] **Step 4: Commit.** `git add backend/prisma && git commit -m "feat(m3a): Skill model + attempt capture columns"`

---

### Task 2: Skill taxonomy seed  ⚠️ capable-model task + USER REVIEW GATE

**Files:**
- Create: `backend/prisma/seed-skills.ts`
- Modify: `backend/prisma/seed.ts` (call `seedSkills(prisma)` after topics are seeded)
- Test: `e2e/m3a-skills-seed.spec.ts`

**Interfaces:**
- Produces: seeded `Skill` rows; exported `MATH_SKILLS: Record<topicSlug, {slug,name}[]>` and
  `WRITING_SKILLS: {slug,name}[]` used by Tasks 8–10 for the closed tag list.

The skill *names/slugs* below are the approved taxonomy draft (89 skills). The implementer
writes a one-to-two-sentence `description` and 2–4-sentence `examLevelNotes` (NSW-Selective
level, ages 10–12) for each — this authoring is judgment work: use a capable model, and the
finished taxonomy is presented to the user for approval **before committing** (spec §3 gate).

```text
number-sentences:      balancing-number-sentences, inverse-operations, order-of-operations, missing-operator-problems
probability:           probability-as-fraction, listing-outcomes, complementary-events, comparing-likelihoods
combinations:          systematic-listing, counting-arrangements, pairing-combinations, tree-diagrams
arithmetic:            mental-addition-subtraction, mental-multiplication-strategies, faster-long-division,
                       decimal-operations, decimal-division, money-calculations, estimation-rounding
patterns:              number-sequence-rules, geometric-growth-patterns, pattern-nth-term, shape-patterns
protractor-skills:     measuring-angles, estimating-angles, angle-types, angles-on-lines-and-points
time:                  elapsed-time, timetable-reading, 24-hour-time, calendar-problems
magic-squares:         magic-square-completion, magic-constant-reasoning, grid-logic-deduction
data-interpretation:   reading-tables, bar-and-line-graphs, pie-charts-proportions,
                       averages-mean-median-mode, two-step-data-problems
time-zones:            time-zone-conversion, elapsed-time-across-zones, timetable-with-zones
number-place-values:   place-value-comparison, ordering-decimals, rounding-decimals, powers-of-ten, expanded-notation
multiples-and-factors: finding-factors, finding-multiples, prime-composite, divisibility-rules
fractions:             equivalent-fractions, comparing-ordering-fractions, fraction-arithmetic,
                       fractions-of-quantities, mixed-improper-conversion, fraction-word-problems
lowest-common-multiple: lcm-calculation, hcf-calculation, lcm-hcf-word-problems
algebra:               substitution, solving-linear-equations, forming-equations-from-words, simplifying-expressions
perimeter:             perimeter-rectilinear, perimeter-composite-shapes, area-perimeter-relationship, missing-side-lengths
directions:            compass-directions, grid-references-maps, turns-and-bearings, relative-position-reasoning
weight:                unit-conversion-mass, balance-scale-problems, weight-word-problems
speed-distance-time:   speed-formula-application, average-speed, distance-time-conversion, speed-word-problems
rotation:              rotational-symmetry, rotating-shapes, angle-of-rotation

writing (topicId null): vocabulary, sentence-variety, ideas, text-structure,
                        punctuation-grammar, audience, cohesion
```

- [ ] **Step 1 (RED): failing e2e** `e2e/m3a-skills-seed.spec.ts` (admin storageState):

```ts
import { test, expect, request as pwRequest } from '@playwright/test';

test('skills are seeded: 20 math topic groups + 7 writing skills', async ({ baseURL }) => {
  const admin = await pwRequest.newContext({ baseURL, storageState: 'e2e/.auth/admin.json' });
  const skills = await (await admin.get('/api/skills')).json();
  const math = skills.filter((s: any) => s.subject === 'math');
  const writing = skills.filter((s: any) => s.subject === 'writing');
  expect(new Set(math.map((s: any) => s.topicSlug)).size).toBe(20);
  expect(writing.map((s: any) => s.slug).sort()).toEqual(
    ['audience', 'cohesion', 'ideas', 'punctuation-grammar', 'sentence-variety', 'text-structure', 'vocabulary']);
  expect(math.find((s: any) => s.slug === 'faster-long-division')).toBeTruthy();
  for (const s of skills) { expect(s.description.length).toBeGreaterThan(10); expect(s.examLevelNotes.length).toBeGreaterThan(10); }
  await admin.dispose();
});
```

(Requires the `GET /api/skills` route from Task 6 — implement Task 6's route file alongside this
task's seed if running tasks strictly in order, or mark this spec `.fixme` until Task 6 and rely
on a unit assertion of the seed arrays' lengths in the meantime. Preferred: build the route here,
Task 6 then only adds the report endpoints.)

- [ ] **Step 2: verify RED** — run `npm run e2e -- m3a-skills-seed`; expected: FAIL (404 / empty).
- [ ] **Step 3: author the taxonomy** in `seed-skills.ts` exporting the two constants and a
  `seedSkills(prisma)` upsert-by-slug function; wire into `seed.ts`; add minimal
  `backend/src/routes/skills.ts` (`GET /` → `requireAdmin`, returns all skills joined with
  `topic.slug` as `topicSlug`), mounted at `/api/skills` in the server entry file (imitate how
  `math-topics.ts` is mounted).
- [ ] **Step 4: USER REVIEW GATE** — present the full taxonomy (names + descriptions +
  examLevelNotes) to the user; do not proceed to commit until approved.
- [ ] **Step 5: verify GREEN** — reseed e2e db, run the spec; expected: PASS. Full suites green.
- [ ] **Step 6: Commit.** `git commit -m "feat(m3a): seed 89-skill NSW taxonomy + /api/skills (user-approved)"`

---

### Task 3: Analytics core — types, helpers (median, SD, halves, thirds)

**Files:**
- Create: `backend/src/services/analytics-core.ts`
- Test: `backend/src/services/analytics-core.test.ts` (vitest, `npm test -w backend`)

**Interfaces:**
- Produces (exact, used by Tasks 4–6):

```ts
export interface AnswerRecord {
  attemptId: number; finishedAt: string; // ISO
  skillSlug: string; skillName: string;
  correct: boolean; chosenIndex: number | null; chosenOptionText: string | null;
  timeMs: number | null; flagged: boolean; answerChanges: number;
  positionIndex: number; attemptSize: number;
}
export interface SkillSignal {
  slug: string; name: string; attempted: number; correct: number; accuracy: number;
  sufficientEvidence: boolean; meanTimeMs: number | null; slow: boolean | null;
  fastWrong: number | null; slowWrong: number | null;
  misconception: { optionIndex: number; share: number; optionText: string | null } | null;
  trendPts: number | null; stabilitySd: number | null;
  flaggedWrong: number; flaggedRight: number; answerChangeHelpRate: number | null;
  cohortAccuracy?: number;
}
export const EVIDENCE_FLOOR = 8; export const EXAM_ANCHOR_MS = 68600;
export function median(xs: number[]): number | null;
export function popStdDev(xs: number[]): number | null;
export function splitAttemptHalves(records: AnswerRecord[]): { older: Set<number>; newer: Set<number> };
export function positionThird(positionIndex: number, attemptSize: number): 'first' | 'middle' | 'final';
```

- [ ] **Step 1 (RED): write the failing tests** — transcribe exactly:

```ts
import { describe, it, expect } from 'vitest';
import { median, popStdDev, splitAttemptHalves, positionThird, AnswerRecord } from './analytics-core';

export function rec(over: Partial<AnswerRecord>): AnswerRecord {
  return { attemptId: 1, finishedAt: '2026-07-01T00:00:00.000Z', skillSlug: 's1', skillName: 'S1',
    correct: false, chosenIndex: 0, chosenOptionText: 'opt', timeMs: null, flagged: false,
    answerChanges: 0, positionIndex: 0, attemptSize: 10, ...over };
}

describe('median', () => {
  it('odd count → middle', () => expect(median([40000, 50000, 60000, 80000, 100000])).toBe(60000));
  it('even count → mean of two middles', () => expect(median([40000, 60000])).toBe(50000));
  it('empty → null', () => expect(median([])).toBeNull());
});

describe('popStdDev (population SD)', () => {
  it('[0.5, 1, 0] → sqrt(1/6)', () => expect(popStdDev([0.5, 1, 0])!).toBeCloseTo(0.408248, 5));
  it('empty → null', () => expect(popStdDev([])).toBeNull());
});

describe('splitAttemptHalves — older half gets the odd extra attempt', () => {
  const recs = [1, 2, 3, 4, 5].map((d) => rec({ attemptId: d, finishedAt: `2026-07-0${d}T00:00:00.000Z` }));
  it('5 attempts → older {1,2,3}, newer {4,5}', () => {
    const { older, newer } = splitAttemptHalves(recs);
    expect([...older].sort()).toEqual([1, 2, 3]); expect([...newer].sort()).toEqual([4, 5]);
  });
});

describe('positionThird — first/final = ceil(n/3) each, middle = remainder', () => {
  it('n=7 → sizes 3/1/3', () => {
    const thirds = [0, 1, 2, 3, 4, 5, 6].map((p) => positionThird(p, 7));
    expect(thirds).toEqual(['first', 'first', 'first', 'middle', 'final', 'final', 'final']);
  });
  it('n=2 → first, final (no middle)', () =>
    expect([positionThird(0, 2), positionThird(1, 2)]).toEqual(['first', 'final']));
  it('n=1 → first', () => expect(positionThird(0, 1)).toBe('first'));
});
```

- [ ] **Step 2: verify RED.** Run: `npm test -w backend -- analytics-core`. Expected: FAIL (module not found).
- [ ] **Step 3: implement** in `analytics-core.ts`:

```ts
export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
export function popStdDev(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}
export function splitAttemptHalves(records: AnswerRecord[]) {
  const seen = new Map<number, string>();
  for (const r of records) if (!seen.has(r.attemptId)) seen.set(r.attemptId, r.finishedAt);
  const ordered = [...seen.entries()].sort((a, b) =>
    a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] - b[0]);
  const olderCount = Math.ceil(ordered.length / 2);
  return { older: new Set(ordered.slice(0, olderCount).map(([id]) => id)),
           newer: new Set(ordered.slice(olderCount).map(([id]) => id)) };
}
export function positionThird(positionIndex: number, attemptSize: number): 'first' | 'middle' | 'final' {
  const firstCount = Math.ceil(attemptSize / 3);
  const lastCount = Math.min(firstCount, attemptSize - firstCount);
  if (positionIndex < firstCount) return 'first';
  if (positionIndex >= attemptSize - lastCount) return 'final';
  return 'middle';
}
```

(plus the two interfaces and constants from the Interfaces block, verbatim).
- [ ] **Step 4: verify GREEN** — same command; all pass. `npm run typecheck` clean.
- [ ] **Step 5: Commit.** `git commit -m "feat(m3a): analytics core types + statistical helpers (hand-computed vectors)"`

---

### Task 4: Analytics core — per-skill signals

**Files:**
- Modify: `backend/src/services/analytics-core.ts`
- Test: append to `backend/src/services/analytics-core.test.ts`

**Interfaces:**
- Produces: `export function computeSkillSignals(records: AnswerRecord[], medianMs: number | null): SkillSignal[]`
  (sorted by slug), and
  `export function computePacingCurve(records: AnswerRecord[]): { first: PacingThird; middle: PacingThird; final: PacingThird }`
  with `export interface PacingThird { total: number; correct: number; accuracy: number | null; unanswered: number; unansweredRate: number | null; }`.

- [ ] **Step 1 (RED): transcribe the vectors exactly:**

```ts
import { computeSkillSignals, computePacingCurve } from './analytics-core';

const sig = (recs: AnswerRecord[], m: number | null, slug = 's1') =>
  computeSkillSignals(recs, m).find((s) => s.slug === slug)!;

describe('accuracy + evidence floor (unanswered counts as wrong)', () => {
  const recs = [
    ...Array.from({ length: 5 }, (_, i) => rec({ correct: true, positionIndex: i })),
    rec({ positionIndex: 5 }), rec({ positionIndex: 6 }),
    rec({ chosenIndex: null, positionIndex: 7 }), // unanswered
    ...Array.from({ length: 7 }, (_, i) => rec({ skillSlug: 's2', skillName: 'S2', correct: i < 2, positionIndex: i, attemptId: 2 })),
  ];
  it('s1: 8 attempted, 5 correct → 0.625, sufficient', () => {
    const s = sig(recs, null);
    expect(s.attempted).toBe(8); expect(s.accuracy).toBeCloseTo(0.625, 6); expect(s.sufficientEvidence).toBe(true);
  });
  it('s2: 7 attempted → insufficient, accuracy still reported', () => {
    const s = sig(recs, null, 's2');
    expect(s.sufficientEvidence).toBe(false); expect(s.accuracy).toBeCloseTo(2 / 7, 6);
  });
});

describe('fast-wrong / slow-wrong with M = 60000 (fast < 36000, slow > 90000, boundaries excluded)', () => {
  const recs = [
    rec({ timeMs: 35999 }), rec({ timeMs: 36000 }), rec({ timeMs: 90000 }), rec({ timeMs: 90001 }),
    rec({ correct: true, timeMs: 30000 }),          // correct: never counted
    rec({ chosenIndex: null, timeMs: 10000 }),      // unanswered: never counted
  ];
  it('counts exactly one fast-wrong and one slow-wrong', () => {
    const s = sig(recs, 60000);
    expect(s.fastWrong).toBe(1); expect(s.slowWrong).toBe(1);
  });
  it('M null → both null', () => {
    const s = sig(recs, null);
    expect(s.fastWrong).toBeNull(); expect(s.slowWrong).toBeNull();
  });
});

describe('slow label: mean > max(1.5 × M, 68600)', () => {
  it('M=60000 → threshold 90000; mean 90001 slow, mean 90000 not', () => {
    expect(sig([rec({ timeMs: 90001 }), rec({ timeMs: 90001 })], 60000).slow).toBe(true);
    expect(sig([rec({ timeMs: 90000 }), rec({ timeMs: 90000 })], 60000).slow).toBe(false);
  });
  it('M=40000 → threshold 68600 (anchor wins); mean 68601 slow', () =>
    expect(sig([rec({ timeMs: 68601 })], 40000).slow).toBe(true));
  it('no timed records → meanTimeMs and slow null', () => {
    const s = sig([rec({})], 60000);
    expect(s.meanTimeMs).toBeNull(); expect(s.slow).toBeNull();
  });
});

describe('misconception fingerprint (≥4 answered-wrong, modal share ≥ 0.5)', () => {
  it('6 wrong choosing [2,2,2,1,3,2] → option 2 at 4/6', () => {
    const recs = [2, 2, 2, 1, 3, 2].map((c, i) => rec({ chosenIndex: c, chosenOptionText: `o${c}`, positionIndex: i }));
    const m = sig(recs, null).misconception!;
    expect(m.optionIndex).toBe(2); expect(m.share).toBeCloseTo(4 / 6, 6); expect(m.optionText).toBe('o2');
  });
  it('share exactly 0.5 with 4 wrong → reported', () => {
    const recs = [2, 2, 1, 3].map((c, i) => rec({ chosenIndex: c, positionIndex: i }));
    expect(sig(recs, null).misconception!.share).toBeCloseTo(0.5, 6);
  });
  it('only 3 wrong → null', () =>
    expect(sig([2, 2, 2].map((c, i) => rec({ chosenIndex: c, positionIndex: i })), null).misconception).toBeNull());
});

describe('pacing curve, n=7 (thirds 3/1/3)', () => {
  const recs = [
    rec({ positionIndex: 0, attemptSize: 7, correct: true }), rec({ positionIndex: 1, attemptSize: 7, correct: true }),
    rec({ positionIndex: 2, attemptSize: 7 }), rec({ positionIndex: 3, attemptSize: 7, correct: true }),
    rec({ positionIndex: 4, attemptSize: 7 }), rec({ positionIndex: 5, attemptSize: 7, chosenIndex: null }),
    rec({ positionIndex: 6, attemptSize: 7, chosenIndex: null }),
  ];
  it('first 2/3 correct; middle 1/1; final 0/3 with unansweredRate 2/3', () => {
    const p = computePacingCurve(recs);
    expect(p.first.accuracy).toBeCloseTo(2 / 3, 6); expect(p.first.unanswered).toBe(0);
    expect(p.middle.accuracy).toBeCloseTo(1, 6);
    expect(p.final.accuracy).toBeCloseTo(0, 6); expect(p.final.unansweredRate).toBeCloseTo(2 / 3, 6);
  });
});
```

- [ ] **Step 2: verify RED** (functions not exported). **Step 3: implement.** Group records by
  `skillSlug`; per group: `attempted = recs.length`, `correct = count(correct)`,
  `accuracy = correct / attempted`, `sufficientEvidence = attempted >= EVIDENCE_FLOOR`;
  timed = recs with `timeMs != null`; `meanTimeMs` = mean of timed (null if none);
  `slow = meanTimeMs == null || medianMs == null ? null : meanTimeMs > Math.max(1.5 * medianMs, EXAM_ANCHOR_MS)`
  — except when `medianMs == null` and `meanTimeMs != null`, compare against the anchor alone is
  NOT allowed: return null (M is required, per test). answeredWrong = recs with
  `chosenIndex != null && !correct`; fast/slowWrong = null when `medianMs == null`, else counts of
  answeredWrong with `timeMs != null` and `timeMs < 0.6*M` / `timeMs > 1.5*M`. Misconception:
  over answeredWrong; if `length >= 4`, modal `chosenIndex` (ties → smaller index), share =
  modalCount/length; report if `share >= 0.5` with the first matching record's
  `chosenOptionText`. `computePacingCurve`: bucket every record via
  `positionThird(positionIndex, attemptSize)`; per bucket `accuracy = total ? correct/total : null`,
  `unansweredRate = total ? unanswered/total : null` (unanswered = `chosenIndex == null`).
  Fill remaining `SkillSignal` fields (`trendPts`, `stabilitySd`, flags, help rate) with
  placeholder `null`/`0` values — Task 5 implements and tests them.
- [ ] **Step 4: verify GREEN**; full backend unit suite passes. **Step 5: Commit.**
  `git commit -m "feat(m3a): per-skill signals — accuracy, time, fast/slow-wrong, misconception, pacing"`

---

### Task 5: Analytics core — trend, stability, flags, cohort, ranking, writing

**Files:**
- Modify: `backend/src/services/analytics-core.ts`
- Test: append to `backend/src/services/analytics-core.test.ts`

**Interfaces:**
- Produces:
```ts
export function computeCohortAccuracy(perStudent: Map<number, SkillSignal[]>): Map<string, number>; // slug → mean; absent when gate fails
export function rankOpportunityAreas(signals: SkillSignal[]): SkillSignal[];
export interface WritingAnalysisRecord { finishedAt: string; criteriaScores: Record<string, number> | null; }
export function computeWritingSignals(records: WritingAnalysisRecord[]): { slug: string; mean: number; trendPts: number | null; n: number }[];
```

- [ ] **Step 1 (RED): transcribe exactly:**

```ts
import { computeCohortAccuracy, rankOpportunityAreas, computeWritingSignals } from './analytics-core';

describe('trend over attempt halves (needs ≥4 questions per half)', () => {
  const mk = (attemptId: number, day: number, corrects: boolean[]) =>
    corrects.map((c, i) => rec({ attemptId, finishedAt: `2026-07-0${day}T00:00:00.000Z`, correct: c, positionIndex: i, attemptSize: 3 }));
  const recs = [...mk(1, 1, [true, false, false]), ...mk(2, 2, [true, false, false]),
                ...mk(3, 3, [true, true, false]), ...mk(4, 4, [true, true, true])];
  it('older 2/6 → newer 5/6 = +50 points', () =>
    expect(sig(recs, null).trendPts!).toBeCloseTo(50, 3));
  it('a half with <4 questions → null', () => {
    const three = [...mk(1, 1, [true, false, false, true] as any), ...mk(2, 2, [true, false, false])];
    // older half (attempt 1) has 4, newer (attempt 2) has 3 → null
    expect(sig(three, null).trendPts).toBeNull();
  });
});

describe('stability: population SD of per-attempt accuracy (attempts with ≥2 skill questions)', () => {
  const recs = [
    rec({ attemptId: 1, correct: true }), rec({ attemptId: 1 }),                     // 0.5
    rec({ attemptId: 2, correct: true }), rec({ attemptId: 2, correct: true }),      // 1.0
    rec({ attemptId: 3 }), rec({ attemptId: 3 }),                                    // 0.0
    rec({ attemptId: 4, correct: true }),                                            // 1 question: excluded
  ];
  it('SD of [0.5, 1, 0] ≈ 0.408248', () => expect(sig(recs, null).stabilitySd!).toBeCloseTo(0.408248, 5));
});

describe('flag and answer-change signals', () => {
  const recs = [
    rec({ flagged: true }), rec({ flagged: true }), rec({ flagged: true, correct: true }),
    rec({ answerChanges: 2, correct: true }), rec({ answerChanges: 1, correct: true }),
    rec({ answerChanges: 1, correct: true }), rec({ answerChanges: 3 }),
  ];
  it('flaggedWrong 2, flaggedRight 1, helpRate 3/4', () => {
    const s = sig(recs, null);
    expect(s.flaggedWrong).toBe(2); expect(s.flaggedRight).toBe(1);
    expect(s.answerChangeHelpRate!).toBeCloseTo(0.75, 6);
  });
  it('no changed answers → helpRate null', () => expect(sig([rec({})], null).answerChangeHelpRate).toBeNull());
});

describe('cohort gate: ≥5 students each with ≥8 attempted on the skill', () => {
  const student = (id: number, acc: number, attempted = 8): [number, SkillSignal[]] =>
    [id, [{ ...sig([rec({})], null), slug: 's1', attempted, correct: 0, accuracy: acc }]];
  it('5 students [0.5..0.9] → mean 0.7', () => {
    const m = computeCohortAccuracy(new Map([student(1, 0.5), student(2, 0.6), student(3, 0.7), student(4, 0.8), student(5, 0.9)]));
    expect(m.get('s1')!).toBeCloseTo(0.7, 6);
  });
  it('one below the floor → only 4 qualify → absent', () => {
    const m = computeCohortAccuracy(new Map([student(1, 0.5), student(2, 0.6), student(3, 0.7), student(4, 0.8), student(5, 0.9, 7)]));
    expect(m.has('s1')).toBe(false);
  });
});

describe('opportunity ranking: sufficient only, accuracy asc, tie → worse trend first (null = 0)', () => {
  const s = (slug: string, accuracy: number, trendPts: number | null, sufficientEvidence = true): SkillSignal =>
    ({ ...sig([rec({})], null), slug, accuracy, trendPts, sufficientEvidence });
  it('orders s3, s1, s2, s4 and drops insufficient s5', () => {
    const ranked = rankOpportunityAreas([s('s1', 0.4, -5), s('s2', 0.4, null), s('s3', 0.3, 0), s('s4', 0.9, 10), s('s5', 0.1, 0, false)]);
    expect(ranked.map((x) => x.slug)).toEqual(['s3', 's1', 's2', 's4']);
  });
});

describe('writing signals: mean + halves trend per criterion', () => {
  const recs = [60, 70, 80, 90].map((v, i) =>
    ({ finishedAt: `2026-07-0${i + 1}T00:00:00.000Z`, criteriaScores: { vocabulary: v } }));
  it('vocabulary mean 75, trend +20 (older [60,70]=65 → newer [80,90]=85)', () => {
    const w = computeWritingSignals(recs).find((x) => x.slug === 'vocabulary')!;
    expect(w.mean).toBeCloseTo(75, 6); expect(w.trendPts!).toBeCloseTo(20, 6); expect(w.n).toBe(4);
  });
  it('null criteriaScores rows are skipped', () =>
    expect(computeWritingSignals([{ finishedAt: '2026-07-01T00:00:00.000Z', criteriaScores: null }])).toEqual([]));
});
```

- [ ] **Step 2: verify RED. Step 3: implement.** Trend: use `splitAttemptHalves` on the *skill's*
  records; per half count questions and corrects; if either half `< 4` questions → null; else
  `(newerAcc − olderAcc) × 100`. Stability: group skill records by attemptId, keep groups of ≥ 2,
  per-group accuracy, `popStdDev` (null if no qualifying groups). Flags: counts by
  `flagged && !correct` / `flagged && correct`. Help rate: records with `answerChanges >= 1`;
  null if none, else `count(correct) / count`. Cohort: for each slug, collect signals with
  `attempted >= EVIDENCE_FLOOR` across students; set mean only when `>= 5`. Ranking: filter
  `sufficientEvidence`, sort by `accuracy` asc then `(trendPts ?? 0)` asc. Writing: for each slug
  present in any non-null `criteriaScores`, mean over rows containing it; trend via the same
  halves split on rows (by `finishedAt`, older gets odd extra), each half needs ≥ 2 rows
  containing the slug, else null.
- [ ] **Step 4: verify GREEN; full suites. Step 5: Commit.**
  `git commit -m "feat(m3a): trend/stability/flags/cohort/ranking/writing signals"`

---

### Task 6: DB adapter + analytics API routes

**Files:**
- Create: `backend/src/services/analytics.service.ts`, `backend/src/routes/analytics.ts`
- Modify: server entry (mount `/api/analytics`)
- Test: `e2e/m3a-analytics-report.spec.ts`

**Interfaces:**
- Produces:
```ts
// analytics.service.ts
export async function getStudentSkillReport(studentId: number, subject: 'math' | 'writing', lastNTests?: number):
  Promise<{ window: { tests: number; from: string | null; to: string | null; medianTimeMs: number | null; untaggedQuestions: number };
            skills: SkillSignal[]; pacing?: ReturnType<typeof computePacingCurve> }>;
export async function getOpportunityAreas(workspaceId: number, subject: 'math' | 'writing', studentId?: number): Promise<SkillSignal[]>;
```
- Routes (all `requireAdmin` + `canAccessUser` on `:id`):
  `GET /api/analytics/students/:id/report?subject=math|writing&lastNTests=`,
  `GET /api/analytics/opportunity-areas?subject=&studentId=`.

**Adapter rules (exact):** last `N` (default 10) `MathAttempt`s by `finishedAt` desc for the
student; per attempt parse `questions`/`answers`/`questionTimings`/`questionFlags`/`answerChanges`
JSON (null-safe); fetch the questions with `skill` included; build one `AnswerRecord` per
question *that has a `skillId`* (count skill-less into `untaggedQuestions`); `chosenIndex`:
answers value `-1` → null; `chosenOptionText`: `JSON.parse(question.options)[chosenIndex]` when
answered; `timeMs`: `questionTimings?.[qid] ?? null`; `flagged`: id ∈ questionFlags;
`answerChanges`: `answerChanges?.[qid] ?? 0`; `positionIndex`/`attemptSize` from the stored
question-id order. `medianTimeMs`: median over ALL the student's attempts' timing values (not
just the window). Writing: last N `Attempt`s with `analysis`, map to `WritingAnalysisRecord`.
Cohort: when ≥ 5 workspace students qualify per §4.6, compute each student's signals over their
own window and merge `cohortAccuracy` into the target's signals.

- [ ] **Step 1 (RED):** `e2e/m3a-analytics-report.spec.ts` — as admin: create two math attempts
  for the e2e student via `POST /api/math/attempts` (student context) using known bank questions
  and deliberately chosen answers (source the key via an admin request, W-28 pattern), including
  `questionTimings`; then `GET /api/analytics/students/:id/report?subject=math` and assert: the
  tagged skills appear with the exact attempted/correct counts implied by the submitted answers,
  `sufficientEvidence` false below 8, and a student-context request to the same URL gets 403/404.
  Watch it fail (route missing).
- [ ] **Step 2: implement service + routes** per the adapter rules; mount router.
- [ ] **Step 3: GREEN + full suites. Step 4: live check** — none (API-only). **Step 5: Commit.**
  `git commit -m "feat(m3a): analytics service adapter + admin report/opportunity endpoints"`

---

### Task 7: Capture instrumentation (timing, flags, answer changes)

**Files:**
- Modify: `frontend/src/pages/MathTimedPractice.tsx`, `backend/src/routes/math-attempts.ts`
- Test: `e2e/m3a-capture.spec.ts`

**Interfaces:**
- Produces: `POST /api/math/attempts` accepts optional `questionTimings` (JSON object string,
  qid → ms), `questionFlags` (JSON int array string), `answerChanges` (JSON object string,
  qid → count); stored verbatim on the row and returned by the existing GETs.

- [ ] **Step 1 (RED):** e2e spec: student runs a 2-question topic practice via the UI
  (`/math/<topic>` timed flow), waits ~500 ms on Q1, flags Q1, answers Q1, moves to Q2, answers,
  changes the answer once, submits; then reads the newest attempt via `GET /api/math/attempts`
  and asserts: `questionTimings` parses to an object whose keys are exactly the two question ids
  with values `> 0`; `questionFlags` parses to `[<q1 id>]`; `answerChanges` parses with
  `{ "<q2 id>": 1 }`. Fails today (fields null).
- [ ] **Step 2: frontend.** In `MathTimedPractice.tsx` add:

```ts
const dwellRef = useRef<Record<number, number>>({});
const lastSwitchRef = useRef<number>(Date.now());
const changesRef = useRef<Record<number, number>>({});
const recordDwell = (qid: number) => {
  const now = Date.now();
  dwellRef.current[qid] = (dwellRef.current[qid] ?? 0) + (now - lastSwitchRef.current);
  lastSwitchRef.current = now;
};
```

Call `recordDwell(currentQ.id)` before every `setCurrentIndex` change (Next/Back/chip jumps) and
at the top of the submit handler. In the answer-select callback, before updating state:
`if (answers[currentQ.id] != null && answers[currentQ.id] !== index) changesRef.current[currentQ.id] = (changesRef.current[currentQ.id] ?? 0) + 1;`
Add to the submit POST body:
`questionTimings: JSON.stringify(dwellRef.current), questionFlags: JSON.stringify([...flagged]), answerChanges: JSON.stringify(changesRef.current)`.
- [ ] **Step 3: backend.** In the POST handler destructure the three optional fields; if a field
  is present, `JSON.parse` it and check shape (`questionTimings`/`answerChanges`: object with
  integer-string keys and non-negative number values; `questionFlags`: integer array) → 400
  `{ error: 'invalid capture payload' }` on failure; persist the raw strings (or null) in
  `prisma.mathAttempt.create`.
- [ ] **Step 4: GREEN + full suites (older specs untouched — fields optional). Step 5: live
  check** — `npm run dev`, run one timed practice, screenshot review of the unchanged test UI.
- [ ] **Step 6: Commit.** `git commit -m "feat(m3a): capture per-question dwell, flags, answer changes"`

---

### Task 8: Skill-tagged generation + verifier tag check

**Files:**
- Modify: `backend/src/services/ai.service.ts` (`generateMathWorksheetQuestions` prompt + parse),
  `backend/src/services/math-worksheet.service.ts` (`validateWorksheetQuestions`,
  `createWorksheetQuestionRows`), OpenAI e2e stub (add `skillSlug` to canned questions)
- Test: `e2e/m3a-generation-tags.spec.ts`

**Interfaces:**
- Consumes: `MATH_SKILLS` from Task 2 (closed list per topic).
- Produces: generated question objects carry `skillSlug`; saved `MathQuestion` rows have
  `skillId` set; `validateWorksheetQuestions` rejects unknown/missing `skillSlug`.

- [ ] **Step 1 (RED):** e2e: admin generates (stubbed) and saves a worksheet; fetch its
  questions as admin via `GET /api/math/questions?worksheetId=` and assert every row includes a
  `skill` with a slug from the topic's closed list; also POST `/api/math/worksheets/save` with a
  question missing `skillSlug` → 400.
- [ ] **Step 2: implement.** Prompt: append the selected topics' skill lists and require
  `"skillSlug": one of [...]` per question. Parse: carry `skillSlug` through. Verifier pass:
  after answer-key verification, ask the verifier whether the tag matches the question against
  the closed list; on mismatch use the verifier's choice (log a `[skill-tag]` line).
  `createWorksheetQuestionRows`: resolve slug → `skillId` (throw `Unknown skill slug: X` → 400,
  same pattern as the existing unknown-topic error). Update the port-3106 stub's canned
  generation payloads to include valid `skillSlug`s.
- [ ] **Step 3: GREEN + full suites. Step 4: Commit.**
  `git commit -m "feat(m3a): skill-tagged question generation with verifier tag check"`

---

### Task 9: Writing criteriaScores + bank backfill script

**Files:**
- Modify: `backend/src/services/ai.service.ts` (`analyzeAttempt` prompt + parse + store), OpenAI
  e2e stub (analysis response gains `criteria`)
- Create: `backend/scripts/backfill-skill-tags.ts`
- Test: `e2e/m3a-writing-criteria.spec.ts`; unit test for the script's slug-validation helper in
  `backend/src/services/analytics-core.test.ts` is NOT the place — put
  `backend/scripts/backfill-skill-tags.test.ts` beside it if the helper is extracted; otherwise
  the script is proven by `--dry-run` output during manual sign-off.

- [ ] **Step 1 (RED):** e2e: student submits a writing attempt (stubbed analysis); assert the
  analysis response/row now includes `criteriaScores` parsing to an object whose keys ⊆ the 7
  writing slugs with 0–100 values, and `GET /api/analytics/students/:id/report?subject=writing`
  (admin) returns a `vocabulary` signal with `n ≥ 1`.
- [ ] **Step 2: implement.** `analyzeAttempt` prompt: additionally return
  `"criteria": {"vocabulary": 0-100, ...}` for exactly the 7 slugs; parse defensively (missing/
  malformed → store null, never fail the analysis); store `criteriaScores` JSON. Update stub.
- [ ] **Step 3: backfill script** (run with `npx tsx scripts/backfill-skill-tags.ts [--dry-run]`
  from `backend/`): for each `MathQuestion` with `skillId IS NULL AND worksheetId IS NULL`, call
  the analysis-role `chatCompletion` with the question + its topic's closed skill list, expect a
  bare slug back, validate against the list; then a verification-role confirm (Y/N); on any
  failure fall back to the topic's first skill and log `[backfill] WARN`. Print a
  topic → slug → count summary table. `--dry-run` prints without writing. (35 bank questions.)
- [ ] **Step 4: GREEN + full suites; run the script against dev.db (real AI, ~35 calls) and
  present the summary table at manual sign-off. Step 5: Commit.**
  `git commit -m "feat(m3a): writing criteria scores + bank skill-tag backfill script"`

---

### Task 10: Skills browser (admin)

**Files:**
- Create: `frontend/src/pages/Skills.tsx`
- Modify: frontend router + `frontend/src/components/Sidebar.tsx` (admin-only "Skills" link),
  `frontend/src/lib/api.ts` (or the existing api module) — `skillsApi.list()`
- Test: `e2e/m3a-skills-browser.spec.ts`

- [ ] **Step 1 (RED):** e2e (admin storageState): visit `/skills`; assert the heading
  "Skills", a topic group heading "Arithmetic", and the skill "Faster long division" with its
  description visible; student storageState: `/skills` link absent from the sidebar and direct
  navigation shows the app's standard not-authorised/redirect behaviour.
- [ ] **Step 2: implement.** Read-only page: fetch `/api/skills`, group by `topicSlug` (math)
  plus a "Writing criteria" group; render name + description; `examLevelNotes` behind a
  per-skill expand. Brand palette, no gradients, no accent-border cards (CLAUDE.md look-and-feel).
- [ ] **Step 3: GREEN + full suites. Step 4: live check** — screenshot `/skills` as admin.
- [ ] **Step 5: Commit.** `git commit -m "feat(m3a): admin skills browser"`

---

## Worklog mapping (create after user approves this plan — CLAUDE.md step 2)

W-31 Task 1 schema · W-32 Task 2 taxonomy seed (user gate) · W-33 Task 3 core helpers ·
W-34 Task 4 per-skill signals · W-35 Task 5 remaining signals · W-36 Task 6 adapter+API ·
W-37 Task 7 capture · W-38 Task 8 generation tags · W-39 Task 9 writing criteria + backfill ·
W-40 Task 10 skills browser.

## M3a exit criteria (from spec §10)

Taxonomy seeded and user-approved; every bank question tagged; a timed test stores all three
capture fields; `getStudentSkillReport` matches the hand-computed vectors; Skills browser
renders. Only then may M3b planning begin.
