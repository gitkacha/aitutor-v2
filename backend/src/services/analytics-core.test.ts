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
