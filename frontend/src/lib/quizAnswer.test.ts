import { describe, it, expect } from 'vitest';
import { checkAnswer } from './quizAnswer';

// W-120: the Guided Quiz accepts short free-text answers with tolerant matching, so a student isn't
// penalised for units, spacing, currency symbols or an equivalent fraction/decimal.
describe('checkAnswer', () => {
  it('matches numbers regardless of units, spaces and symbols', () => {
    expect(checkAnswer('20', '20')).toBe(true);
    expect(checkAnswer('20 books', '20')).toBe(true);
    expect(checkAnswer(' 20 ', '20')).toBe(true);
    expect(checkAnswer('$120', '120')).toBe(true);
    expect(checkAnswer('120 people', '120')).toBe(true);
    expect(checkAnswer('10 km/h', '10')).toBe(true);
  });

  it('matches simple fractions and equivalent decimals', () => {
    expect(checkAnswer('23/40', '23/40')).toBe(true);
    expect(checkAnswer('23 / 40', '23/40')).toBe(true);
    expect(checkAnswer('0.5', '1/2')).toBe(true);
  });

  it('accepts any of the acceptable variants', () => {
    expect(checkAnswer('half', '50%', ['half', '0.5'])).toBe(true);
    expect(checkAnswer('0.5', '50%', ['half', '0.5'])).toBe(true);
  });

  it('rejects clear misses and empty input', () => {
    expect(checkAnswer('30', '20')).toBe(false);
    expect(checkAnswer('', '20')).toBe(false);
    expect(checkAnswer('twenty-one', '20')).toBe(false);
  });
});
