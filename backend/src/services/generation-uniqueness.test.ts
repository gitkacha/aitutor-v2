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

import { buildGenerationBatchPrompt } from './ai.service';

const topic = (slug: string, name: string) => ({
  id: 1, name, slug, description: `${name} description`,
  questions: [{ id: 1, questionText: `hardest ${name} q`, options: '[]', correctIndex: 0, explanation: '', percentCorrect: 20 }],
});

describe('buildGenerationBatchPrompt — topic briefs A/B', () => {
  it("variant 'on' with a briefed topic injects the DISTRACTOR and FIGURES rules", () => {
    const prompt = buildGenerationBatchPrompt([topic('data-interpretation', 'Data Interpretation')], 10, [], { briefVariant: 'on' });
    expect(prompt).toContain('DISTRACTOR RULE');
    expect(prompt).toContain('FIGURES — DRAW THEM ACCURATELY');
    expect(prompt.toLowerCase()).toContain('counting gridlines instead of the gaps');
  });

  it("variant 'off' emits the baseline prompt (no brief text) for a briefed topic", () => {
    const t = [topic('data-interpretation', 'Data Interpretation')];
    const off = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'off' });
    expect(off).not.toContain('DISTRACTOR RULE');
    expect(off).not.toContain('FIGURES — DRAW THEM ACCURATELY');
  });

  it("variant 'on' with only unbriefed topics equals the baseline (no brief text)", () => {
    const t = [topic('arithmetic', 'Arithmetic')];
    const on = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'on' });
    const off = buildGenerationBatchPrompt(t, 10, [], { briefVariant: 'off' });
    expect(on).toBe(off);
    expect(on).not.toContain('DISTRACTOR RULE');
  });
});

// W-147: pie questions must leave room to infer — the model should NOT label every slice; some
// slices are left unlabelled (showPercent:false) for the student to derive by a clean calculation.
describe('buildGenerationBatchPrompt — pie inference guidance', () => {
  it('tells the model to leave some pie slices unlabelled for the student to infer', () => {
    // Base-prompt guidance (present regardless of the brief A/B variant).
    const prompt = buildGenerationBatchPrompt([topic('data-interpretation', 'Data Interpretation')], 10, [], { briefVariant: 'off' });
    expect(prompt).toContain('PIE LABELS — LEAVE ROOM TO INFER');
    expect(prompt).toContain('showPercent":false');
    const lower = prompt.toLowerCase();
    expect(lower).toContain('infer');
    // The inference must stay a clean calculation, never an eyeball-angle guess.
    expect(lower).toContain('by eye');
  });
});
