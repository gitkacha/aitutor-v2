import { describe, it, expect } from 'vitest';
import { median, popStdDev, splitAttemptHalves, positionThird, AnswerRecord } from './analytics-core';
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
