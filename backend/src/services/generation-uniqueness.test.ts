import { describe, it, expect } from 'vitest';
import { buildUniquenessInstructions, normalizeQuestionText } from './ai.service';

// W-87: generated worksheets must have strictly no duplicate/repeated questions. Two deterministic
// pieces: (1) the prompt instructions that tell the model what to avoid (incl. the direction-turn
// rule), and (2) normalized-text dedup that hard-guarantees no exact/normalized repeat.

describe('buildUniquenessInstructions', () => {
  it('always includes the direction/turn uniqueness rule (start direction + turn recipe)', () => {
    const text = buildUniquenessInstructions([]);
    expect(text.toLowerCase()).toContain('direction');
    expect(text.toLowerCase()).toContain('quarter turns');
    expect(text.toLowerCase()).toContain('half turns');
    // No two questions may share the same starting direction + same turn sequence.
    expect(text.toLowerCase()).toMatch(/starting (compass )?direction/);
  });

  it('lists the questions to avoid when given prior questions', () => {
    const prior = ['Chris starts facing North and makes 3 half turns right then 5 quarter turns left.'];
    const text = buildUniquenessInstructions(prior);
    expect(text).toContain('Chris starts facing North');
    expect(text.toLowerCase()).toMatch(/do not|never/);
  });
});

describe('normalizeQuestionText', () => {
  it('collapses case, whitespace and punctuation so exact/near-exact repeats match', () => {
    const a = normalizeQuestionText('  Chris faces North.  He makes 3 HALF turns! ');
    const b = normalizeQuestionText('chris faces north he makes 3 half turns');
    expect(a).toBe(b);
  });

  it('keeps genuinely different questions distinct', () => {
    expect(normalizeQuestionText('Lily faces West.')).not.toBe(normalizeQuestionText('Chris faces North.'));
  });
});
