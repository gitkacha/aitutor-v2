import { describe, it, expect } from 'vitest';
import { gridTicks, explicitAxisProps } from './chart-ticks';

// W-158: with an explicit axis, the Recharts <YAxis> must receive interval:0 so the GRID renders a
// line at every tick. Without it, Recharts' default 'preserveEnd' tick-thinning can drop an interior
// gridline (e.g. 50) while the axis labels still show all ticks.
describe('explicitAxisProps', () => {
  it('returns {} when the figure has no explicit axis (auto-scale unchanged)', () => {
    expect(explicitAxisProps(undefined, undefined)).toEqual({});
    expect(explicitAxisProps(60, undefined)).toEqual({});
  });

  it('sets domain, full ticks, allowDecimals and interval:0 for an explicit axis', () => {
    const props = explicitAxisProps(60, 10);
    expect(props).toEqual({
      domain: [0, 60],
      ticks: [0, 10, 20, 30, 40, 50, 60],
      allowDecimals: true,
      interval: 0,
    });
  });
});

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
