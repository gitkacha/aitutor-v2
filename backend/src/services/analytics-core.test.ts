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
