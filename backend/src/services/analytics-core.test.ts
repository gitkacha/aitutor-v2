import { describe, it, expect } from 'vitest';
import { median, popStdDev, splitAttemptHalves, positionThird, AnswerRecord, SkillSignal } from './analytics-core';
import { computeSkillSignals, computePacingCurve } from './analytics-core';

const sig = (recs: AnswerRecord[], m: number | null, slug = 's1') =>
  computeSkillSignals(recs, m).find((s) => s.slug === slug)!;

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

import { computeCohortAccuracy, rankOpportunityAreas, rankWritingOpportunityAreas, computeWritingSignals } from './analytics-core';

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

describe('writing opportunity ranking: sufficient only, mean asc, tie → worse trend first (null = 0)', () => {
  // WritingSkillSignal-shaped fixtures (slug, name, mean, trendPts, n, sufficientEvidence).
  interface WritingSkillSignalFixture {
    slug: string; name: string; mean: number; trendPts: number | null; n: number; sufficientEvidence: boolean;
  }
  const w = (slug: string, mean: number, trendPts: number | null, sufficientEvidence = true): WritingSkillSignalFixture =>
    ({ slug, name: slug.toUpperCase(), mean, trendPts, n: 8, sufficientEvidence });
  it('orders w3, w1, w2, w4 and drops insufficient w5', () => {
    // w1/w2 tie on mean 0.5: w1's trendPts -5 sorts before w2's null (coalesced to 0).
    const ranked = rankWritingOpportunityAreas([
      w('w1', 0.5, -5), w('w2', 0.5, null), w('w3', 0.3, 0), w('w4', 0.9, 10), w('w5', 0.1, 0, false),
    ]);
    expect(ranked.map((x) => x.slug)).toEqual(['w3', 'w1', 'w2', 'w4']);
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

import { computeSkillTrendSeries } from './analytics-core';

// M3b-2 Task 2 (W-52): per-skill accuracy over time — one point per attempt containing the skill.
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
    expect(series[0].correct).toBe(1);
    expect(series[1].accuracy).toBeCloseTo(1, 6);
  });

  it('sorts by finishedAt then attemptId, and is empty when the skill never appears', () => {
    expect(computeSkillTrendSeries([], 's1')).toEqual([]);
    const recs = [r(5, 3, true), r(4, 2, false)]; // out of order
    expect(computeSkillTrendSeries(recs, 's1').map((p) => p.attemptId)).toEqual([4, 5]);
  });
});

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
