import { describe, it, expect } from 'vitest';
import { validateStimulus, parseStimulus } from '../lib/stimulus';

const wrap = (figure: unknown) => ({ version: 1, text: 'ctx', figures: [figure] });

describe('validateStimulus', () => {
  it('accepts every supported figure kind', () => {
    const figures = [
      { kind: 'table', columns: ['A', 'B'], rows: [['x', 1], ['y', 2]] },
      { kind: 'grid', rows: 3, cols: 4, filled: [[0, 0], [2, 3]] },
      { kind: 'line-chart', points: [{ x: '9 am', y: 0 }, { x: '10 am', y: 2 }] },
      { kind: 'bar-chart', points: [{ x: 1, y: 5 }, { x: 2, y: 7 }] },
      { kind: 'pie-chart', sectors: [{ label: 'A', percent: 60 }, { label: 'B', percent: 40 }] },
      { kind: 'protractor', rays: [20, 50], joinPairs: [[20, 50]] },
      { kind: 'compass', facing: 'NE' },
      { kind: 'shape', unit: 'cm', vertices: [[0, 0], [4, 0], [4, 3]], sideLabels: [{ side: 0, label: '4 cm' }] },
      { kind: 'rotation', shape: 'flag', beforeDeg: 0, afterDeg: 225 },
      { kind: 'cards', values: ['4/5', '0.15'] },
    ];
    for (const f of figures) {
      expect(validateStimulus(wrap(f)), `kind ${(f as any).kind}`).toBe(true);
    }
  });

  it('rejects malformed specs', () => {
    expect(validateStimulus(null)).toBe(false);
    expect(validateStimulus({ version: 2, figures: [] })).toBe(false);
    expect(validateStimulus({ version: 1, figures: [] })).toBe(false); // needs >= 1 figure
    expect(validateStimulus(wrap({ kind: 'nonsense' }))).toBe(false);
    expect(validateStimulus(wrap({ kind: 'protractor', rays: [200] }))).toBe(false); // > 180°
    expect(validateStimulus(wrap({ kind: 'protractor', rays: [20], joinPairs: [[20, 99]] }))).toBe(false); // join to missing ray
    expect(validateStimulus(wrap({ kind: 'pie-chart', sectors: [{ label: 'A', percent: 50 }, { label: 'B', percent: 30 }] }))).toBe(false); // sums to 80
    expect(validateStimulus(wrap({ kind: 'grid', rows: 2, cols: 2, filled: [[2, 0]] }))).toBe(false); // out of bounds
    expect(validateStimulus(wrap({ kind: 'line-chart', points: [{ x: 'only', y: 1 }] }))).toBe(false); // < 2 points
    expect(validateStimulus(wrap({ kind: 'rotation', shape: 'squiggle', beforeDeg: 0, afterDeg: 90 }))).toBe(false);
    expect(validateStimulus(wrap({ kind: 'shape', vertices: [[0, 0], [1, 1]] }))).toBe(false); // < 3 vertices
  });

  it('rejects grid labels that do not match the grid size (L14)', () => {
    expect(validateStimulus(wrap({ kind: 'grid', rows: 2, cols: 3, rowLabels: ['1'] }))).toBe(false); // 1 label, 2 rows
    expect(validateStimulus(wrap({ kind: 'grid', rows: 2, cols: 3, colLabels: ['A', 'B'] }))).toBe(false); // 2 labels, 3 cols
    expect(
      validateStimulus(wrap({ kind: 'grid', rows: 2, cols: 3, rowLabels: ['1', '2'], colLabels: ['A', 'B', 'C'] }))
    ).toBe(true);
  });
});

describe('parseStimulus', () => {
  it('parses a valid JSON spec', () => {
    const raw = JSON.stringify(wrap({ kind: 'protractor', rays: [15, 115] }));
    const spec = parseStimulus(raw);
    expect(spec?.figures[0].kind).toBe('protractor');
  });

  it('returns null for legacy prose and invalid JSON', () => {
    expect(parseStimulus('The following line graph details ...')).toBeNull();
    expect(parseStimulus('{"version":1,"figures":"nope"}')).toBeNull();
    expect(parseStimulus('{broken')).toBeNull();
  });
});
