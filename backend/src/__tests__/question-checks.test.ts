import { describe, it, expect } from 'vitest';
import { hasDistinctOptions, explanationMatchesKey, keptByEscalation } from '../lib/question-checks';

describe('hasDistinctOptions (W-20)', () => {
  it('rejects options that share a value even when written differently', () => {
    expect(hasDistinctOptions(['5/10', '25/50', '2/5', '4/5', '3/5'])).toBe(false); // both = 1/2
    expect(hasDistinctOptions(['0.5', '1/2'])).toBe(false);
    expect(hasDistinctOptions(['100', '1,00', '2'])).toBe(false); // 100 == 1,00
  });
  it('accepts genuinely distinct options', () => {
    expect(hasDistinctOptions(['3', '4', '5', '6', '7'])).toBe(true);
    expect(hasDistinctOptions(['2 hours', '3 hours', '2.5 hours'])).toBe(true);
  });
});

describe('explanationMatchesKey (W-20)', () => {
  it('passes when the concluding option matches the key', () => {
    expect(explanationMatchesKey('Two plus two is 4. The answer is Option B.', 1)).toBe(true);
  });
  it('fails when the explanation names a different option than the key', () => {
    expect(explanationMatchesKey('It is 4. The answer is Option B.', 2)).toBe(false); // says B, key C
  });
  it('uses the last named option', () => {
    expect(explanationMatchesKey('Not Option A. Actually the answer is Option C.', 2)).toBe(true);
  });
  it('is not constrained when no option is named', () => {
    expect(explanationMatchesKey('The total is 12.', 3)).toBe(true);
  });
});

describe('keptByEscalation (W-20)', () => {
  const KEY = 1;
  it('keeps only when at least two verdicts agree with the key', () => {
    expect(keptByEscalation([0, 1, 1], KEY)).toBe(true);  // pass1 wrong, 2 & 3 agree
    expect(keptByEscalation([1, 1, 1], KEY)).toBe(true);
    expect(keptByEscalation([0, 0, 1], KEY)).toBe(false); // only one agrees
    expect(keptByEscalation([0, 2, 1], KEY)).toBe(false);
  });
  it('rejects if any verdict is "none of the options" (negative)', () => {
    expect(keptByEscalation([-1, 1, 1], KEY)).toBe(false);
    expect(keptByEscalation([1, 1, -1], KEY)).toBe(false);
  });
});
