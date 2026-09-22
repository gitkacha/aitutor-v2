import { describe, it, expect } from 'vitest';
import { isMultiple, fracInInterval, isClean, safeGridPairs, pickGrid, gridTicks, inferSubdivision } from './chart-grid';

describe('chart-grid numeric core', () => {
  it('isMultiple / fracInInterval', () => {
    expect(isMultiple(6, 2)).toBe(true);
    expect(isMultiple(7, 2)).toBe(false);
    expect(fracInInterval(3, 2)).toBeCloseTo(0.5); // 3 is halfway in a step-2 grid
    expect(fracInInterval(4, 2)).toBeCloseTo(0);
  });
  it('isClean converts to real units first', () => {
    expect(isClean(0.5, 100, 1)).toBe(true);   // 0.5 hundreds = 50 → clean
    expect(isClean(0.5, 1, 1)).toBe(false);     // 0.5 in whole units → not clean
  });
  it('safeGridPairs — whole-number units (unit=1, cleanStep=1): a fraction G/d must itself be a whole number', () => {
    const pairs = safeGridPairs([2, 3, 4, 9, 10, 12, 20, 24], 1, 1);
    const has = (G: number, d: number) => pairs.some((p) => p.G === G && p.d === d);
    // thirds where G/3 is whole and G/4 is NOT also clean:
    expect(has(3, 3)).toBe(true);   // 3/3 = 1
    expect(has(9, 3)).toBe(true);   // 9/3 = 3
    // quarters require G divisible by 4 (G/4 whole). NOT G=2 (0.5) or G=10 (2.5):
    expect(has(2, 4)).toBe(false);
    expect(has(10, 4)).toBe(false);
    expect(has(4, 4)).toBe(true);   // 4/4 = 1
    expect(has(20, 4)).toBe(true);  // 20/4 = 5
    // G=12 and 24: thirds AND quarters both clean → both excluded; halves still allowed:
    expect(has(12, 3)).toBe(false);
    expect(has(12, 4)).toBe(false);
    expect(has(24, 3)).toBe(false);
    expect(has(24, 4)).toBe(false);
    expect(has(12, 2)).toBe(true);
    expect(has(24, 2)).toBe(true);
  });

  it('safeGridPairs — real units (unit=100, cleanStep=50): quarters of G=2/10 become clean (0.5→50, 2.5→250)', () => {
    const pairs = safeGridPairs([2, 10], 100, 50);
    const has = (G: number, d: number) => pairs.some((p) => p.G === G && p.d === d);
    // With an axis in hundreds and a 50-visitor clean step, a quarter of a 2-step (0.5 = 50) is
    // clean, and the rival third (66.7) is not — so these quarter grids are now safe.
    expect(has(2, 4)).toBe(true);
    expect(has(10, 4)).toBe(true);
  });
  it('gridTicks + inferSubdivision', () => {
    expect(gridTicks(8, 2)).toEqual([0, 2, 4, 6, 8]);
    expect(inferSubdivision(2, [0, 2, 4])).toBe(1);
    expect(inferSubdivision(2, [1, 2, 3])).toBe(2); // halves
    expect(inferSubdivision(2, [1.1])).toBeNull();  // finer than quarters
  });
  it('pickGrid returns a config whose yMax is a multiple of G', () => {
    const cfg = pickGrid({ candidateGs: [2, 4, 10, 20], unit: 100, cleanStep: 25, difficulty: 'hard', rng: () => 0 });
    expect(cfg.yMax % cfg.G).toBe(0);
    expect(cfg.d).toBeGreaterThanOrEqual(3); // hard → thirds/quarters
  });
});
