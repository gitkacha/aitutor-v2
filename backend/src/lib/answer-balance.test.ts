import { describe, it, expect } from 'vitest';
import { balanceAnswerPositions } from './answer-balance';
import { explanationMatchesKey, hasDistinctOptions } from './question-checks';

type Q = {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  skillSlug: string;
};

const mk = (i: number, correctIndex: number, explanation: string): Q => ({
  questionText: `Q${i}`,
  options: ['alpha', 'beta', 'gamma', 'delta'],
  correctIndex,
  explanation,
  topicSlug: 'visual-reasoning',
  skillSlug: 'visual-reasoning',
});

// Deterministic RNG (linear congruential) so the test is stable.
function seededRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

describe('balanceAnswerPositions', () => {
  it('spreads correct-answer positions ~evenly across 4 options (no clustering)', () => {
    // 16 questions all keyed to option A — the exact bias we saw in production.
    const qs = Array.from({ length: 16 }, (_, i) => mk(i, 0, 'Reasoned by content, no letter here.'));
    balanceAnswerPositions(qs, 4, seededRng(7));

    const counts = [0, 0, 0, 0];
    for (const q of qs) counts[q.correctIndex]++;
    // Each of the 4 positions should carry a fair share — never the old 16/0/0/0.
    for (const c of counts) {
      expect(c).toBeGreaterThanOrEqual(2);
      expect(c).toBeLessThanOrEqual(6);
    }
    expect(counts.reduce((a, b) => a + b, 0)).toBe(16);
  });

  it('moves the correct option to its new slot and keeps options distinct', () => {
    const qs = [mk(1, 0, 'Reasoned by content.')];
    const before = qs[0].options[0]; // the correct option's text
    balanceAnswerPositions(qs, 4, seededRng(3));
    expect(qs[0].options[qs[0].correctIndex]).toBe(before);
    expect(hasDistinctOptions(qs[0].options)).toBe(true);
  });

  it('remaps "Option X" letter references so the explanation still matches the key', () => {
    // 12 A-keyed questions whose explanations name "Option A" explicitly.
    const qs = Array.from({ length: 12 }, (_, i) => mk(i, 0, `The first choice is forced. Therefore, the answer is Option A.`));
    balanceAnswerPositions(qs, 4, seededRng(11));
    for (const q of qs) {
      // Whatever slot the answer moved to, the named letter must match it.
      expect(explanationMatchesKey(q.explanation, q.correctIndex)).toBe(true);
    }
    // And at least one actually moved off A (so the remap really happened).
    expect(qs.some((q) => q.correctIndex !== 0)).toBe(true);
  });

  it('leaves content-only explanations untouched', () => {
    const qs = [mk(1, 0, 'No option letters mentioned at all.')];
    balanceAnswerPositions(qs, 4, seededRng(1));
    expect(qs[0].explanation).toBe('No option letters mentioned at all.');
  });
});
