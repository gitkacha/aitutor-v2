import { describe, it, expect } from 'vitest';
import { buildGenerationBatchPrompt, isValidGeneratedQuestion, subjectOfTopics } from './ai.service';

// W-93 (Thinking Skills, Task 5): the generation engine is subject-parametrized. Math stays
// 5-option with its exact prompt wording (regression guard); thinking-skills is 4-option with the
// fold-cut/target figures in the vocabulary. Exemplars anchor difficulty for both.
const topic = (slug: string, name: string, subject: string, exemplar: string) => ({
  id: 1, name, slug, subject, description: `${name} desc`,
  questions: [{ id: 1, questionText: exemplar, options: '[]', correctIndex: 0, explanation: 'x', percentCorrect: null }],
});

describe('buildGenerationBatchPrompt', () => {
  it('math: five-option, four distractors, 5-option example, no thinking-skills figures (regression)', () => {
    const p = buildGenerationBatchPrompt([topic('algebra', 'Algebra', 'math', 'A math exemplar')], 10, []);
    expect(p).toContain('five-option multiple-choice');
    expect(p).toContain('four plausible distractors');
    expect(p).toContain('["A", "B", "C", "D", "E"]');
    expect(p).not.toContain('fold-cut');
    expect(p).not.toContain('"kind":"target"');
    // The lesson-only figure-embedding directive must never leak into the MCQ prompt (W-115).
    expect(p).not.toContain('```figure');
    // Explanations use the lessons' intuitive speed-tricks + clean numbers, not decimal grinding (W-122).
    expect(p).toContain('Building Blocks');
    expect(p).toMatch(/fractions[\s\S]*decimals/i);
    // W-139: pies/angles the student must read visually must be intuitive (45°/90°/180° ↔ eighths/
    // quarters/halves), never an awkward slice to decipher — and the example pie must not model one.
    expect(p).toContain('READABLE SLICES & ANGLES');
    expect(p).not.toContain('"percent":27');
    // W-139 follow-on: clean angles must NOT water the question down — data-interpretation questions
    // stay multi-step at NSW Selective difficulty (proportion→quantity, reverse, compare, chain).
    expect(p).toContain('MULTI-STEP DATA INTERPRETATION');
  });

  it('thinking-skills: four-option, three distractors, 4-option example, fold-cut + target figures, exemplar anchored', () => {
    const p = buildGenerationBatchPrompt(
      [topic('visual-reasoning', 'Visual Reasoning', 'thinking-skills', 'Kyle throws three darts at the target')],
      10, [], { optionCount: 4, subject: 'thinking-skills' },
    );
    expect(p).toContain('four-option multiple-choice');
    expect(p).toContain('three plausible distractors');
    expect(p).toContain('["A", "B", "C", "D"]');
    expect(p).not.toContain('["A", "B", "C", "D", "E"]');
    expect(p).toContain('fold-cut');
    expect(p).toContain('"kind":"target"');
    expect(p).toContain('Kyle throws three darts at the target'); // exemplar difficulty anchor
  });
});

describe('isValidGeneratedQuestion', () => {
  // A structurally valid question: distinct options, a real skill for its topic, explanation names
  // the keyed option. `visual-reasoning` topic/skill exist in THINKING_SKILLS.
  const allowed = new Set(['visual-reasoning']);
  const q = (n: number) => ({
    questionText: 'Q', options: Array.from({ length: n }, (_, i) => `opt-${i}`), correctIndex: 0,
    explanation: 'Reasoning. Therefore, the answer is Option A.', topicSlug: 'visual-reasoning', skillSlug: 'visual-reasoning',
  });
  it('accepts a 4-option question when optionCount is 4, rejects a 5-option one', () => {
    expect(isValidGeneratedQuestion(q(4), allowed, 4)).toBe(true);
    expect(isValidGeneratedQuestion(q(5), allowed, 4)).toBe(false);
  });
  it('defaults to 5-option (math unchanged)', () => {
    expect(isValidGeneratedQuestion(q(5), allowed)).toBe(true);
    expect(isValidGeneratedQuestion(q(4), allowed)).toBe(false);
  });
});

describe('subjectOfTopics', () => {
  it('returns the shared subject', () => {
    expect(subjectOfTopics([{ subject: 'thinking-skills' }, { subject: 'thinking-skills' }])).toBe('thinking-skills');
  });
  it('throws when subjects are mixed', () => {
    expect(() => subjectOfTopics([{ subject: 'math' }, { subject: 'thinking-skills' }])).toThrow(/mix/i);
  });
});
