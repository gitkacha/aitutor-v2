import { describe, it, expect } from 'vitest';
import { gridTicks } from './chart-ticks';

describe('gridTicks', () => {
  it('builds inclusive ticks from 0 to yMax at the given step', () => {
    expect(gridTicks(8, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(gridTicks(9, 3)).toEqual([0, 3, 6, 9]);
  });
  it('returns [0] when the step is not positive or does not divide yMax cleanly', () => {
    expect(gridTicks(8, 0)).toEqual([0]);
    expect(gridTicks(10, 3)).toEqual([0]); // 10/3 not integer → unusable, degrade to [0]
  });
});
