# Milestone 3c-1 — Student Encouragement: Most Improved + Weekly Streak

**Status:** Approved design (brainstormed and approved 2026-07-25). Treatment A chosen for Most
Improved; weekly-goal streak chosen.
**Depends on:** M3a analytics foundation (per-skill signals, timing capture), M3b (interventions).
**Relationship to M3c:** This is M3c **Phase 1 (Encouragement)** — student-facing, independent of
the coaching library. M3c **Phase 2** is the coaching library + student lessons (main M3 spec §8),
which later enriches the Most Improved "how" line. Build order: Phase 1 first.

## 0. Goal & principles

Balance the existing **Opportunity Areas** (what's weak) with **what's improving**, and add a
**weekly streak** to encourage students to keep coming back. Both are student-facing and must feel
encouraging, never punishing.

- **Accuracy is still deterministic and honest.** All statistics are computed in `analytics-core`;
  the endpoints only relay them. We never celebrate noise — every claimed improvement is
  evidence-gated.
- **No answer-key exposure (§0.6 of the M3 spec).** The new student-facing endpoint returns only
  improvement highlights (skill names, accuracy/speed deltas) — no questions, options, correctIndex
  or explanations.
- **Kind by construction.** The streak never shows a bleak zero, and the in-progress week can't
  break it.

## 1. Most Improved (treatment A) — math, v1

A calm green panel on the student Dashboard **above** Opportunity Areas: "You're getting better
at…". Improved **topics** as rows (overall gain); clicking a topic expands to its **top 3 improved
skills**, each badged by the metric that moved most — accuracy (green `▲ 40% → 78%`) or speed
(blue `⚡ 22% quicker`).

### 1.1 Per-skill improvement (analytics-core, deterministic)

Over the student's window (last N=10 math attempts), for each skill with `sufficientEvidence`
(≥ `EVIDENCE_FLOOR`=8 attempted):

- **Accuracy gain** `accGainPts` = `trendPts` (the existing newer-half − older-half accuracy × 100),
  defined only when each half has ≥ 4 questions of the skill (existing rule); else null.
- **Speed gain** `quickerPct` = `(olderMeanMs − newerMeanMs) / olderMeanMs × 100`, defined only when
  each half has ≥ 3 **timed** questions of the skill and `olderMeanMs > 0`; else null.
- **Eligible as improved** if `accGainPts >= 8` **or** `quickerPct >= 15`.
- **Shown metric** (deterministic): `gainScore = max(accGainPts ?? -Infinity, quickerPct ?? -Infinity)`;
  the shown metric is whichever produced the max (tie → accuracy). So a skill headlines accuracy
  unless its speed gain is the larger number.
- Fields returned per improved skill: `{ slug, name, metric: 'accuracy'|'speed', accuracyFrom,
  accuracyTo, quickerPct, gainScore }` (accuracy fields = older/newer half accuracy as 0–1
  fractions; only the shown metric's fields need be meaningful, but include both when computed).

New exported `analytics-core` function (pure, hand-computed unit vectors):
`computeSkillImprovements(records: AnswerRecord[], medianMs: number | null): ImprovedSkill[]`
returning only eligible improved skills, sorted by `gainScore` desc.

### 1.2 Topic grouping & ranking

- Group eligible improved skills by their topic.
- A topic appears in Most Improved iff it has ≥ 1 improved skill.
- **Topic headline delta:** the topic's own accuracy trend over all its records (newer − older half,
  points) when `>= 5`; else the best `quickerPct` among its improved skills (shown as "X% quicker").
- **Rank** topics by (count of improved skills desc, then best `gainScore` desc). Return the top 5.
- Each topic carries its top 3 improved skills (by `gainScore`).

### 1.3 The "how" line (Phase 1: light; Phase 2: rich)

Phase 1 shows a data-derived encouragement line per expanded topic (e.g. "Up across your last few
tests — keep it going"). Phase 2 (coaching library) replaces it, when the improved skill was
targeted by an intervention whose lesson the student completed, with "Biggest lift came after the
'<lesson>' lesson." The endpoint returns an optional `interventionId` per topic when one targeted a
shown skill, so the UI can later deep-link; Phase 1 ignores it.

### 1.4 Endpoint

`GET /api/analytics/me/improvements?subject=math` — **`requireAuth`**; returns the **caller's own**
improvements. An admin may pass `?studentId=` and is authorised via `canAccessUser` (out-of-scope →
404). Response:
```json
{ "topics": [
  { "slug": "arithmetic", "name": "Arithmetic",
    "delta": { "metric": "accuracy", "points": 21 },
    "interventionId": 3,
    "skills": [
      { "slug": "decimal-division", "name": "Decimal Division", "metric": "accuracy", "accuracyFrom": 0.40, "accuracyTo": 0.78, "quickerPct": null, "gainScore": 38 },
      { "slug": "faster-long-division", "name": "Faster Long Division", "metric": "speed", "accuracyFrom": null, "accuracyTo": null, "quickerPct": 22, "gainScore": 22 }
    ] }
] }
```
Adapter (`analytics.service`) reuses `buildMathRecords` (no stats in the adapter). Empty `topics`
when nothing qualifies (the UI then hides the panel).

### 1.5 UI

`frontend/src/components/MostImproved.tsx`, rendered on `frontend/src/pages/Dashboard.tsx` above the
Opportunity Areas section. Expandable topic rows (one open at a time is fine, or independent);
accuracy badge green, speed badge blue, per the approved mockup. Hidden entirely when `topics` is
empty (no "nothing improved yet" nag — Opportunity Areas already covers the gap). Brand palette; no
gradients/purple. Look-and-feel matches Dashboard/`ScoreHistory` idioms.

## 2. Weekly-goal streak

`streakWeeks` = the number of consecutive most-recent weeks the student hit their weekly session
goal (`SESSION_GOAL` = 5, the existing momentum ring's goal), computed from **non-demo** attempts
(writing + math), per student.

### 2.1 Computation (deterministic)

- Bucket the student's finished attempts by **ISO week** (Monday start) using `finishedAt`.
- `hit(week)` = `sessions(week) >= SESSION_GOAL`, where a session is one finished attempt (same unit
  as `sessionsThisWeek`).
- Let `cur` = the ISO week containing "now".
  - If `hit(cur)`: `streakWeeks` = 1 + consecutive hits for `cur-1, cur-2, …` until a miss.
  - Else (current week still in progress / not yet hit): `streakWeeks` = consecutive hits for
    `cur-1, cur-2, …` until a miss. **The in-progress current week neither adds to nor breaks the
    streak.**
- Pure helper in a small module (`backend/src/lib/streak.ts`):
  `computeWeeklyStreak(weekKeysWithCounts: Map<string, number>, nowISOWeek: string, goal: number): number`
  — hand-computed unit vectors (streak of 3 incl. current-week-hit; streak preserved when the
  current week is a miss-in-progress; broken by a completed miss).

### 2.2 Endpoint

Extend the existing stats endpoint (the one returning `sessionsThisWeek`, `backend/src/routes/
stats.ts`) to also return `streakWeeks: number`. Same auth/scoping as today (own by default; admin
via `?studentId=`). One extra grouped count query per call; acceptable at local scale.

### 2.3 UI

In `frontend/src/components/Sidebar.tsx`, beside the weekly momentum ring: when `streakWeeks >= 1`,
show "**{streakWeeks}-week streak** 🔥"; when `0`, show a gentle "Hit 5 this week to start a streak"
(never a bleak "0-week streak"). Small, celebratory, consistent with the "celebrates effort not
scores" tone already there.

## 3. Testing (mandatory workflow, RED-first)

- **analytics-core unit tests** (the accuracy proof): `computeSkillImprovements` — accuracy-only
  win, speed-only win, both-present pick-the-larger, threshold boundaries (accGainPts 7 vs 8,
  quickerPct 14 vs 15), evidence gating (insufficient halves → excluded), sorting by gainScore.
- **streak unit tests**: `computeWeeklyStreak` — current-week-hit extends; current-week-miss-in-
  progress preserves; a completed missed week breaks; zero when the last completed week missed.
- **e2e (`e2e/m3c1-*.spec.ts`)**: seed a student with dated tagged attempts showing a skill rising
  0%→100% across two halves → `GET /api/analytics/me/improvements` returns that topic/skill with the
  accuracy metric; a student-context call returns only their own; a second student is isolated.
  Streak e2e: seed ≥5 attempts in each of 2 consecutive weeks → `streakWeeks >= 2`. UI e2e: the
  Dashboard shows the Most Improved panel with the topic → expand → skill badge; the sidebar shows
  the streak.
- Full `npm run e2e` + `npm test` + `npm run typecheck` green before every commit; live screenshot
  of the Dashboard panel and the sidebar streak.

## 4. Success criteria

A student with real improvement sees a "You're getting better at…" panel: improved math topics,
each expanding to its top 3 improved skills badged by accuracy or speed (whichever gained most),
evidence-gated so nothing is celebrated on noise; the sidebar shows a weekly-goal streak that a
single missed day can't break and that never reads as a bleak zero. No answer keys are exposed; all
numbers come from `analytics-core`. Then M3c Phase 2 (coaching library) is planned.

## 5. Out of scope for Phase 1 (noted, not built)

- Writing "most improved" (criterion gains) — a clean follow-up once the math version proves out.
- The lesson-specific "how" line — lands with M3c Phase 2 (coaching), using `interventionId`.
- Daily streaks / streak freezes — the weekly-goal streak was chosen deliberately.
