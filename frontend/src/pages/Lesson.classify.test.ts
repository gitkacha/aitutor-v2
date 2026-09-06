import { describe, it, expect } from 'vitest';
import { classify } from './Lesson';

// W-118: the tactical (approach B) headings must map to sensible section treatments WITHOUT
// regressing the standard (approach A) mapping — in particular "The Selective Trap" is the hook (an
// idea), not a red "traps to avoid" section.
describe('Lesson section classify', () => {
  it('maps tactical (B) headings correctly', () => {
    expect(classify('1. The Selective Trap')).toBe('idea');
    expect(classify('2. The Intuitive Building Block')).toBe('steps');
    expect(classify('3. The Speed Shortcut')).toBe('trick');
    expect(classify('4. Guided Drills')).toBe('examples');
  });

  it('does not regress standard (A) headings', () => {
    expect(classify('The idea')).toBe('idea');
    expect(classify('Step by step')).toBe('steps');
    expect(classify('Speed technique')).toBe('trick');
    expect(classify('Worked examples')).toBe('examples');
    expect(classify('Traps to avoid')).toBe('traps');
  });
});
