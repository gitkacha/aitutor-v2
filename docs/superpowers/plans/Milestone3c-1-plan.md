# Milestone 3c-1 — Student Encouragement (Most Improved + Weekly Streak) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give students a "You're getting better at…" panel (improved math topics → top-3 improved
skills, accuracy-or-speed) and a kind weekly-goal practice streak — both built on the deterministic
analytics, no answer keys exposed.

**Architecture:** New pure `analytics-core` functions compute per-skill improvements (accuracy +
speed) and the weekly streak, proven by hand-computed vectors. Thin adapters expose a student-facing
improvements endpoint (topic grouping via the Skill table) and add `streakWeeks` to the stats
endpoint. Two focused frontend components render the panel (Dashboard) and the streak (Sidebar).

**Tech Stack:** Existing only — Prisma/SQLite, Express, vitest, React, Recharts (not needed here),
Playwright.

**Spec:** `docs/superpowers/specs/2026-07-25-m3c-encouragement-design.md`.

## Global Constraints

- CLAUDE.md mandatory 5-step workflow per task; worklog W-58…W-62 map to Tasks 1–5, ticked only
  after user sign-off.
- RED first; full `npm run e2e` + `npm test` + `npm run typecheck` green before every commit; live
  screenshot for the two UI tasks.
- **Accuracy non-negotiable (spec §0):** all statistics live in `analytics-core`; adapters map rows
  and may group/sort core outputs (like `rankOpportunityAreas`) but compute no new statistic.
- **No answer-key exposure (§0.6):** `/api/analytics/me/improvements` returns only skill names +
  accuracy/speed deltas — no questions/options/correctIndex/explanations.
- **Kind streak:** never render "0-week streak"; the in-progress current week can't break the streak.
- Exact thresholds: skill improved iff `accGainPts >= 8` OR `quickerPct >= 15`; accuracy half needs
  ≥4 questions, speed half needs ≥3 timed; `EVIDENCE_FLOOR`=8; `SESSION_GOAL`=5; math only (v1).
- Look-and-feel: brand green for accuracy wins, brand blue for speed; no gradients/purple/accent-
  border cards; match Dashboard/Sidebar idioms.

## Note on one deliberate simplification vs the spec

Spec §1.2 defines the **topic headline delta** as "the topic's own accuracy trend". To avoid a
second, redundant statistic (a topic-wide trend on top of the per-skill trends), this plan sets the
topic headline to the topic's **best improved skill's gain** (metric + value) — a *selection* over
core-computed values in the adapter, not a recomputed statistic, consistent with the "adapter may
group/sort core outputs" rule. Same information ("Arithmetic — up, +38%"), less machinery.

---

### Task 1: analytics-core — `computeSkillImprovements`

**Files:**
- Modify: `backend/src/services/analytics-core.ts`
- Test: append to `backend/src/services/analytics-core.test.ts`

**Interfaces:**
- Produces:
```ts
export interface ImprovedSkill {
  slug: string; name: string;
  metric: 'accuracy' | 'speed';
  accGainPts: number | null;      // (newerHalfAcc - olderHalfAcc) * 100
  quickerPct: number | null;      // (olderMeanMs - newerMeanMs) / olderMeanMs * 100
  accuracyFrom: number | null; accuracyTo: number | null; // older/newer half accuracy, 0..1
  gainScore: number;              // max(accGainPts ?? -Infinity, quickerPct ?? -Infinity)
}
export function computeSkillImprovements(records: AnswerRecord[]): ImprovedSkill[]; // eligible only, gainScore desc
```
(No `medianMs` needed — speed is a within-skill older/newer comparison.)

- [ ] **Step 1 (RED): transcribe exactly** (reuses the exported `rec` fixture + `splitAttemptHalves`):

```ts
import { computeSkillImprovements } from './analytics-core';

// A skill from two attempts (older = attempt1, newer = attempt2) so splitAttemptHalves gives
// older={1}, newer={2}. corrects/times are per-question arrays for that attempt.
const half = (attemptId: number, day: number, corrects: boolean[], times: (number|null)[], slug='s1') =>
  corrects.map((c, i) => rec({ attemptId, finishedAt: `2026-07-0${day}T00:00:00.000Z`, skillSlug: slug, skillName: slug.toUpperCase(), correct: c, timeMs: times[i] }));
const n = (k: number, total: number): boolean[] => Array.from({ length: total }, (_, i) => i < k); // k trues of total

describe('computeSkillImprovements', () => {
  it('accuracy win: older 1/4 (25%) → newer 3/4 (75%) = +50 pts, metric accuracy', () => {
    const recs = [...half(1,1,n(1,4),[null,null,null,null]), ...half(2,2,n(3,4),[null,null,null,null])];
    const [s] = computeSkillImprovements(recs);
    expect(s.metric).toBe('accuracy');
    expect(s.accGainPts).toBeCloseTo(50, 6);
    expect(s.accuracyFrom).toBeCloseTo(0.25, 6);
    expect(s.accuracyTo).toBeCloseTo(0.75, 6);
    expect(s.gainScore).toBeCloseTo(50, 6);
  });

  it('speed win: flat accuracy, older mean 100000 → newer 70000 = 30% quicker, metric speed', () => {
    const recs = [...half(1,1,n(2,4),[100000,100000,100000,100000]), ...half(2,2,n(2,4),[70000,70000,70000,70000])];
    const [s] = computeSkillImprovements(recs);
    expect(s.accGainPts).toBeCloseTo(0, 6);   // computed, below the +8 gate
    expect(s.metric).toBe('speed');
    expect(s.quickerPct).toBeCloseTo(30, 6);
    expect(s.gainScore).toBeCloseTo(30, 6);
  });

  it('both improved → pick the larger: accGain +10 vs quicker 25% → speed', () => {
    const recs = [...half(1,1,n(4,10),Array(10).fill(100000)), ...half(2,2,n(5,10),Array(10).fill(75000))];
    const [s] = computeSkillImprovements(recs);
    expect(s.accGainPts).toBeCloseTo(10, 6);   // 50% − 40%
    expect(s.quickerPct).toBeCloseTo(25, 6);   // (100000 − 75000)/100000
    expect(s.metric).toBe('speed');            // 25 > 10
    expect(s.gainScore).toBeCloseTo(25, 6);
  });

  it('accuracy gate: +4 pts (below 8) excluded; +8 pts included', () => {
    const below = [...half(1,1,n(10,25),Array(25).fill(null)), ...half(2,2,n(11,25),Array(25).fill(null))]; // 40%→44% = +4
    expect(computeSkillImprovements(below).length).toBe(0);
    const at = [...half(1,1,n(10,25),Array(25).fill(null)), ...half(2,2,n(12,25),Array(25).fill(null))];    // 40%→48% = +8
    const [s] = computeSkillImprovements(at);
    expect(s.metric).toBe('accuracy');
    expect(s.accGainPts).toBeCloseTo(8, 6);
  });

  it('speed gate: 10% quicker (below 15) excluded; 20% quicker included', () => {
    const below = [...half(1,1,n(2,4),[100000,100000,100000,100000]), ...half(2,2,n(2,4),[90000,90000,90000,90000])]; // 10%
    expect(computeSkillImprovements(below).length).toBe(0);
    const at = [...half(1,1,n(2,4),[100000,100000,100000,100000]), ...half(2,2,n(2,4),[80000,80000,80000,80000])];    // 20%
    expect(computeSkillImprovements(at)[0].metric).toBe('speed');
  });

  it('insufficient evidence (attempted < 8) → excluded', () => {
    const recs = [...half(1,1,[true],[null]), ...half(2,2,[false],[null])]; // 2 attempted
    expect(computeSkillImprovements(recs).length).toBe(0);
  });

  it('sorted by gainScore desc', () => {
    const recs = [
      ...half(1,1,n(2,10),Array(10).fill(null),'lo'), ...half(2,2,n(4,10),Array(10).fill(null),'lo'), // +20
      ...half(1,1,n(1,10),Array(10).fill(null),'hi'), ...half(2,2,n(6,10),Array(10).fill(null),'hi'), // +50
    ];
    expect(computeSkillImprovements(recs).map((s) => s.slug)).toEqual(['hi', 'lo']);
  });
});
```

- [ ] **Step 2: verify RED** (`npm test -w backend -- analytics-core`; function missing).
- [ ] **Step 3: implement** `computeSkillImprovements`: group records by `skillSlug`; per skill with
  `attempted >= EVIDENCE_FLOOR`, split via `splitAttemptHalves`; accuracy branch when each half has
  ≥4 questions (`accGainPts`, `accuracyFrom/To`), else nulls; speed branch when each half has ≥3
  records with `timeMs != null` (`quickerPct` from half means), else null; eligible iff
  `(accGainPts ?? -Infinity) >= 8 || (quickerPct ?? -Infinity) >= 15`; `gainScore = max(accGainPts ??
  -Infinity, quickerPct ?? -Infinity)`; `metric = (quickerPct != null && quickerPct > (accGainPts ??
  -Infinity)) ? 'speed' : 'accuracy'`; return eligible sorted by `gainScore` desc.
- [ ] **Step 4: verify GREEN** + full backend suite + typecheck. **Step 5: Commit.**
  `git commit -m "feat(m3c1): computeSkillImprovements (accuracy + speed, hand-computed vectors)"`

---

### Task 2: Improvements adapter + student endpoint

**Files:**
- Modify: `backend/src/services/analytics.service.ts`, `backend/src/routes/analytics.ts`
- Test: `e2e/m3c1-improvements.spec.ts`

**Interfaces:**
- Produces:
```ts
export interface ImprovedTopic {
  slug: string; name: string;
  delta: { metric: 'accuracy' | 'speed'; value: number }; // best improved skill's gain (points or %)
  interventionId: number | null;                           // an active intervention targeting a shown skill, if any
  skills: ImprovedSkill[];                                  // top 3 by gainScore
}
export async function getMathImprovements(studentId: number): Promise<{ topics: ImprovedTopic[] }>;
```
- Route: `GET /api/analytics/me/improvements?subject=math&studentId?=` — `requireAuth`; caller's own
  by default; with `studentId`, `canAccessUser` (out-of-scope → 404). subject must be `math`.

- [ ] **Step 1 (RED):** `e2e/m3c1-improvements.spec.ts` — tag one question under a topic no other
  spec tags (e.g. `weight`/`unit-conversion-mass`), have the e2e student submit ≥8 questions of it
  across two dated attempts rising older→newer (source the key via an admin request, W-28 pattern —
  mirror `e2e/m3b2-skill-trend.spec.ts`); then as the **student** `GET
  /api/analytics/me/improvements?subject=math` returns a topic whose `skills` include that skill with
  `metric:'accuracy'` and `accuracyTo > accuracyFrom`; a second student (throwaway) sees it absent
  (isolation); admin `?studentId=<e2e student>` sees it; admin `?studentId=<other-workspace>` → 404.
- [ ] **Step 2: verify RED. Step 3: implement.** `getMathImprovements`: build the student's records
  via the shared `buildMathRecords` over their last-N math attempts (reuse `buildMathWindow`);
  `computeSkillImprovements(records)`; resolve each improved skill's topic via
  `prisma.skill.findMany({ where: { slug: { in } }, select: { slug, topic: { select: { slug, name } } } })`;
  group by topic; per topic take top 3 skills by `gainScore`, set `delta` = the top skill's
  `{metric, value: metric==='accuracy' ? round(accGainPts) : round(quickerPct)}`; `interventionId` =
  the most recent active `Intervention` for the student whose `skillSlugs` include a shown skill (else
  null); rank topics by (skills.length desc, top gainScore desc), take top 5. Route: `requireAuth`,
  own-or-`canAccessUser`, subject guard.
- [ ] **Step 4: GREEN + full suites. Step 5: Commit.**
  `git commit -m "feat(m3c1): student-facing math improvements endpoint"`

---

### Task 3: Weekly-goal streak — core + stats endpoint

**Files:**
- Create: `backend/src/lib/streak.ts`; Test: `backend/src/lib/streak.test.ts`
- Modify: `backend/src/routes/stats.ts`
- Test: `e2e/m3c1-streak.spec.ts`

**Interfaces:**
- Produces:
```ts
// streak.ts — weeks[0] is the current (most-recent) week, weeks[1] the prior, …
export function computeWeeklyStreak(weeks: { count: number }[], goal: number, currentInProgress: boolean): number;
```
- `GET /api/stats` response gains `streakWeeks: number` alongside `sessionsThisWeek`.

- [ ] **Step 1 (RED): transcribe exactly:**

```ts
import { computeWeeklyStreak } from './streak';
describe('computeWeeklyStreak (goal 5)', () => {
  it('current week hit extends the streak', () =>
    expect(computeWeeklyStreak([{count:6},{count:5},{count:5},{count:0}], 5, true)).toBe(3));
  it('current week in-progress miss neither adds nor breaks', () =>
    expect(computeWeeklyStreak([{count:2},{count:5},{count:6},{count:0}], 5, true)).toBe(2));
  it('a completed missed week breaks it', () =>
    expect(computeWeeklyStreak([{count:2},{count:1}], 5, true)).toBe(0));
  it('empty history → 0', () => expect(computeWeeklyStreak([], 5, true)).toBe(0));
});
```

- [ ] **Step 2: verify RED. Step 3: implement** `computeWeeklyStreak`: `let start = (currentInProgress
  && (weeks[0]?.count ?? 0) < goal) ? 1 : 0; let streak = 0; for (let i = start; i < weeks.length; i++)
  { if (weeks[i].count >= goal) streak++; else break; } return streak;`.
- [ ] **Step 4: stats route.** In `backend/src/routes/stats.ts`, keep `sessionsThisWeek`; additionally
  fetch the scope's non-demo `Attempt` + `MathAttempt` `finishedAt` for the last 60 weeks, bucket by
  Monday-start ISO week into counts, build `weeks` descending from the current week (zero-fill gaps),
  and return `streakWeeks: computeWeeklyStreak(weeks, 5, true)`.
- [ ] **Step 5:** `e2e/m3c1-streak.spec.ts` — the e2e student submits ≥5 attempts dated in the
  current week and ≥5 dated in the prior week → `GET /api/stats` returns `streakWeeks >= 2`
  (assert `>= 2`, robust to other attempts). RED→GREEN.
- [ ] **Step 6: full suites + typecheck. Step 7: Commit.**
  `git commit -m "feat(m3c1): weekly-goal streak (core vectors + stats endpoint)"`

---

### Task 4: Most Improved panel (Dashboard UI)

**Files:**
- Create: `frontend/src/components/MostImproved.tsx`
- Modify: `frontend/src/lib/api.ts` (`improvementsApi` + types), `frontend/src/pages/Dashboard.tsx`
- Test: `e2e/m3c1-most-improved-ui.spec.ts`

**Interfaces:**
- Consumes: the Task 2 endpoint. Add to `api.ts`:
```ts
export interface ImprovedSkillDTO { slug: string; name: string; metric: 'accuracy'|'speed'; accuracyFrom: number|null; accuracyTo: number|null; quickerPct: number|null; gainScore: number }
export interface ImprovedTopicDTO { slug: string; name: string; delta: { metric: 'accuracy'|'speed'; value: number }; interventionId: number|null; skills: ImprovedSkillDTO[] }
export const improvementsApi = { math: () => fetchJSON<{ topics: ImprovedTopicDTO[] }>('/analytics/me/improvements?subject=math') };
```

- [ ] **Step 1 (RED):** `e2e/m3c1-most-improved-ui.spec.ts` — seed an improving skill for the e2e
  student (reuse Task 2's setup), visit `/dashboard`, assert a "You're getting better at…" panel with
  the topic row; click it → the improved skill name + a badge (accuracy `→` or `quicker`) is visible.
  Also assert the panel is ABSENT for a student with no improvements (a fresh throwaway student).
- [ ] **Step 2: verify RED. Step 3: implement** `MostImproved.tsx`: fetch `improvementsApi.math()`;
  render nothing when `topics` is empty; else a white panel titled "You're getting better at…" with
  expandable topic rows (green ▲, topic name, `delta` as `+{value}%` for accuracy or `{value}% quicker`
  for speed); expanded → the top-3 skills each with a badge — accuracy `▲ {round(from*100)}% → {round(to*100)}%`
  (green) or `⚡ {round(quickerPct)}% quicker` (blue). Match the approved treatment-A mockup + brand
  palette. Render it in `Dashboard.tsx` immediately above the Opportunity Areas section.
- [ ] **Step 4: GREEN + full suites + typecheck. Step 5: live screenshot** of the Dashboard panel
  (collapsed + one expanded). **Step 6: Commit.**
  `git commit -m "feat(m3c1): Most Improved dashboard panel"`

---

### Task 5: Weekly streak (Sidebar UI)

**Files:**
- Modify: `frontend/src/lib/api.ts` (`getStats` return type), `frontend/src/components/Sidebar.tsx`
- Test: `e2e/m3c1-streak-ui.spec.ts`

**Interfaces:**
- Consumes: `getStats()` now returns `{ sessionsThisWeek: number; streakWeeks: number }`.

- [ ] **Step 1 (RED):** `e2e/m3c1-streak-ui.spec.ts` — seed ≥5 attempts in the current week and ≥5 in
  the prior week for the e2e student (reuse Task 3's setup), visit `/dashboard`, assert the sidebar
  shows a "week streak" indicator with a number ≥ 2. (Default student storageState.)
- [ ] **Step 2: verify RED. Step 3: implement.** Update `api.ts` `getStats` return type to include
  `streakWeeks`. In `Sidebar.tsx`, read `streakWeeks` alongside `sessionsThisWeek`; beside the
  momentum ring render, when `streakWeeks >= 1`, `"{streakWeeks}-week streak 🔥"`; when `0`, the
  gentle `"Hit 5 this week to start a streak"`. Small, matches the rail's existing momentum styling;
  no bleak zero.
- [ ] **Step 4: GREEN + full suites + typecheck. Step 5: live screenshot** of the sidebar streak.
  **Step 6: Commit.** `git commit -m "feat(m3c1): weekly streak in the sidebar"`

---

## Worklog mapping (create after user approves — CLAUDE.md step 2)

W-58 Task 1 computeSkillImprovements · W-59 Task 2 improvements endpoint · W-60 Task 3 streak core +
stats · W-61 Task 4 Most Improved UI · W-62 Task 5 streak UI.

## M3c-1 exit criteria (spec §4)

A student with real improvement sees "You're getting better at…" (improved math topics → top-3
improved skills, accuracy-or-speed, evidence-gated) above Opportunity Areas, and a kind weekly-goal
streak in the sidebar that a missed day can't break and never reads as zero. No answer keys exposed;
all numbers from `analytics-core`. Then M3c Phase 2 (coaching library) is planned.
