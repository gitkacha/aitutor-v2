import { describe, it, expect } from 'vitest';
import { buildWorksheetInterventionMap } from './intervention-worksheets';

describe('buildWorksheetInterventionMap', () => {
  it('maps object-shaped worksheetIds by subject', () => {
    const ivs = [{ id: 7, worksheetIds: JSON.stringify({ math: [1, 2], writing: [3] }) }];
    expect([...buildWorksheetInterventionMap(ivs, 'math')]).toEqual([[1, 7], [2, 7]]);
    expect([...buildWorksheetInterventionMap(ivs, 'writing')]).toEqual([[3, 7]]);
  });

  it('treats a flat array as math ids (chat generation is math-only)', () => {
    const ivs = [{ id: 9, worksheetIds: JSON.stringify([4, 5]) }];
    expect([...buildWorksheetInterventionMap(ivs, 'math')]).toEqual([[4, 9], [5, 9]]);
    expect([...buildWorksheetInterventionMap(ivs, 'writing')]).toEqual([]);
  });

  it('keeps the first intervention when two reference the same worksheet, and ignores bad JSON', () => {
    const ivs = [
      { id: 1, worksheetIds: JSON.stringify({ math: [10] }) },
      { id: 2, worksheetIds: JSON.stringify({ math: [10, 11] }) },
      { id: 3, worksheetIds: 'not json' },
    ];
    const map = buildWorksheetInterventionMap(ivs, 'math');
    expect(map.get(10)).toBe(1);
    expect(map.get(11)).toBe(2);
    expect(map.size).toBe(2);
  });
});
