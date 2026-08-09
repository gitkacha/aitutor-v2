import { describe, it, expect } from 'vitest';
import { checkGridCompassDirection } from './grid-compass';

// W-88: deterministic correctness check for grid → compass-direction questions. The grid figure
// renders rowLabels TOP-TO-BOTTOM, so North = top (earlier row index). This catches the attempt-93
// Q4 bug where the key said North-West but the figure shows South-West.
const grid = {
  version: 1,
  text: '6×6 grid',
  figures: [{ kind: 'grid', rows: 6, cols: 6, filled: [], rowLabels: ['1', '2', '3', '4', '5', '6'], colLabels: ['A', 'B', 'C', 'D', 'E', 'F'] }],
};
const q = (text: string, answer: string) => ({
  questionText: text,
  options: ['North-East', 'North-West', 'South-East', 'South-West', 'North'],
  correctIndex: ['North-East', 'North-West', 'South-East', 'South-West', 'North'].indexOf(answer),
  stimulus: grid,
});

describe('checkGridCompassDirection', () => {
  it("flags the attempt-93 Q4 key as WRONG (D3->B5 is South-West on the figure, not North-West)", () => {
    expect(checkGridCompassDirection(q('Maria is at D3 and the school is at B5. Which direction to go from D3 to B5?', 'North-West'))).toBe('wrong');
  });

  it('accepts the correct South-West key for the same question', () => {
    expect(checkGridCompassDirection(q('go from D3 to B5?', 'South-West'))).toBe('ok');
  });

  it('handles cardinal directions using the rendered top-to-bottom rows (A1->A3 is South)', () => {
    expect(checkGridCompassDirection({ ...q('walk from A1 to A3?', 'South-East'), options: ['North', 'South', 'East', 'West', 'North-East'], correctIndex: 1 })).toBe('ok');
    expect(checkGridCompassDirection({ ...q('walk from A1 to A3?', 'South-East'), options: ['North', 'South', 'East', 'West', 'North-East'], correctIndex: 0 })).toBe('wrong');
  });

  it('flags an ambiguous move (2 left, 1 up is not a single compass direction) as wrong', () => {
    // D3 -> B4: 2 cols left, 1 row down → not exactly diagonal/cardinal.
    expect(checkGridCompassDirection(q('from D3 to B4?', 'South-West'))).toBe('wrong');
  });

  it('returns n/a for non-compass questions', () => {
    expect(checkGridCompassDirection({ questionText: 'from D3 to B5, how many squares?', options: ['1', '2', '3', '4', '5'], correctIndex: 3, stimulus: grid })).toBe('na');
  });

  it('returns n/a when there is no grid figure', () => {
    expect(checkGridCompassDirection({ ...q('from D3 to B5?', 'North-West'), stimulus: undefined })).toBe('na');
  });
});
