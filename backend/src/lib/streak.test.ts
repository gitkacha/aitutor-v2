import { describe, it, expect } from 'vitest';
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
