import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub the AI seam: the service must call chatCompletion(providerFor(role), prompt, ...) and
// nothing else. We assert on the ORCHESTRATION (generate → verify → one retry), not on prompt
// wording (which is judgment work, §11).
const chatCompletion = vi.fn();
vi.mock('./ai.service', () => ({
  providerFor: (role: string) => ({ model: `stub-${role}`, baseUrl: '', apiKey: 'k', tokensParam: 'max_tokens' }),
  chatCompletion: (...args: unknown[]) => chatCompletion(...args),
}));

import { generateCoachingModuleContent, verifyWorkedExamples } from './coaching.service';

const skill = {
  name: 'Balancing Number Sentences',
  slug: 'balancing-number-sentences',
  examLevelNotes: 'Keep both sides equal; work backwards from the total.',
  misconceptions: ['adds instead of subtracts'],
};

beforeEach(() => chatCompletion.mockReset());

describe('generateCoachingModuleContent', () => {
  it('retries generation exactly once when the verifier flags an example, then succeeds', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nbad example 7x8=54', usage: null }) // gen #1
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["Example 1: 7x8 is 56, not 54"]}', usage: null }) // verify #1
      .mockResolvedValueOnce({ content: '## The idea\ngood example 7x8=56', usage: null }) // gen #2 (retry)
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null }); // verify #2

    const result = await generateCoachingModuleContent(skill);

    expect(chatCompletion).toHaveBeenCalledTimes(4); // gen, verify, gen(retry), verify
    expect(result.verifierWarnings).toEqual([]);
    expect(result.content).toContain('7x8=56');
    expect(result.title).toBe('Balancing Number Sentences');
  });

  it('saves the draft with warnings attached when the retry still fails (no second retry)', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: 'gen1 bad', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["still wrong"]}', usage: null })
      .mockResolvedValueOnce({ content: 'gen2 still bad', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":false,"warnings":["still wrong again"]}', usage: null });

    const result = await generateCoachingModuleContent(skill);

    expect(chatCompletion).toHaveBeenCalledTimes(4); // exactly one retry, no more
    expect(result.verifierWarnings).toEqual(['still wrong again']);
    expect(result.content).toBe('gen2 still bad');
  });

  it('does not retry when the first draft verifies clean', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nall good', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });

    const result = await generateCoachingModuleContent(skill);

    expect(chatCompletion).toHaveBeenCalledTimes(2); // gen, verify — no retry
    expect(result.verifierWarnings).toEqual([]);
  });
});

describe('generateCoachingModuleContent subject-awareness (W-110)', () => {
  it('math (default) runs the arithmetic verifier and uses maths-skill prompt wording', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nall good', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });

    await generateCoachingModuleContent(skill, 'math');

    expect(chatCompletion).toHaveBeenCalledTimes(2); // gen + verify
    const genPrompt = chatCompletion.mock.calls[0][1] as string;
    expect(genPrompt).toContain('ONE maths skill');
  });

  it('thinking-skills generates WITHOUT the arithmetic verifier and uses reasoning wording', async () => {
    chatCompletion.mockResolvedValueOnce({ content: '## The idea\nreasoning lesson', usage: null });

    const result = await generateCoachingModuleContent(skill, 'thinking-skills');

    // Only the generation call — the arithmetic verifier is math-only (TS is admin-reviewed).
    expect(chatCompletion).toHaveBeenCalledTimes(1);
    expect(result.verifierWarnings).toEqual([]);
    const genPrompt = chatCompletion.mock.calls[0][1] as string;
    expect(genPrompt).not.toContain('maths skill');
    expect(genPrompt.toLowerCase()).toContain('reasoning');
  });
});

describe('generation prompt teaches figures + the teaching framework (W-115)', () => {
  async function promptFor(subject: 'math' | 'thinking-skills'): Promise<string> {
    // One generation call is enough to capture the prompt; give the verifier an ok reply for math.
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nlesson', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    await generateCoachingModuleContent(skill, subject);
    return chatCompletion.mock.calls[0][1] as string;
  }

  it('math: prompt embeds the ```figure vocabulary and the speed-shortcut framework', async () => {
    const p = await promptFor('math');
    expect(p).toContain('```figure');
    expect(p).toContain('pie-chart');
    expect(p.toLowerCase()).toContain('shortcut');
    // math wording preserved (W-110 regression)
    expect(p).toContain('ONE maths skill');
  });

  it('thinking-skills: prompt embeds the ```figure vocabulary, reasoning wording', async () => {
    chatCompletion.mockReset();
    chatCompletion.mockResolvedValueOnce({ content: '## The idea\nlesson', usage: null });
    await generateCoachingModuleContent(skill, 'thinking-skills');
    const p = chatCompletion.mock.calls[0][1] as string;
    expect(p).toContain('```figure');
    expect(p.toLowerCase()).toContain('shortcut');
    expect(p).not.toContain('maths skill');
    expect(p.toLowerCase()).toContain('reasoning');
  });
});

describe('generation prompt prefers intuitive "Building Blocks" shortcuts (W-117)', () => {
  async function promptFor(subject: 'math' | 'thinking-skills'): Promise<string> {
    chatCompletion.mockReset();
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nlesson', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    await generateCoachingModuleContent(skill, subject);
    return chatCompletion.mock.calls[0][1] as string;
  }

  it('math: teaches the smallest clean whole-number stepping-stone and forbids ugly fractions', async () => {
    const p = (await promptFor('math')).toLowerCase();
    expect(p).toContain('building block');
    expect(p).toContain('whole number');
  });

  it('thinking-skills: the same intuitive-shortcut guidance is present (shared, not math-only)', async () => {
    const p = (await promptFor('thinking-skills')).toLowerCase();
    expect(p).toContain('building block');
    expect(p).toContain('whole number');
  });
});

describe('lesson prompt is the single tactical structure (W-118/W-123)', () => {
  async function promptFor(subject: 'math' | 'thinking-skills'): Promise<string> {
    chatCompletion.mockReset();
    chatCompletion
      .mockResolvedValueOnce({ content: '# The Selective Trap\nlesson', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    await generateCoachingModuleContent(skill, subject);
    return chatCompletion.mock.calls[0][1] as string;
  }

  it('math: uses the 4-part structure, the figure engine, and the mental-model library', async () => {
    const p = await promptFor('math');
    expect(p).toContain('Selective Trap');
    expect(p).toContain('Building Block');
    expect(p).toContain('Speed Shortcut');
    // Section 4 is an interactive quiz, not a solution-revealing drill (W-120).
    expect(p).toContain('Guided Quiz');
    expect(p).not.toContain('Guided Drills');
    expect(p).toContain('```quiz');
    // W-136: a question may carry its own small figure; don't reuse the lesson figure across questions.
    expect(p).toContain('PER-QUESTION FIGURE');
    expect(p).toContain('```figure');
    // Draws on the named concrete mental models the user asked for.
    expect(p).toContain('Bar Model');
    expect(p).toContain('Clock Face');
  });

  it('thinking-skills: reasoning wording, no "maths skill"', async () => {
    const p = await promptFor('thinking-skills');
    expect(p).toContain('Selective Trap');
    expect(p).not.toContain('maths skill');
  });

  it('requests a generous completion budget (>= 12000)', async () => {
    chatCompletion.mockReset();
    chatCompletion
      .mockResolvedValueOnce({ content: '# The Selective Trap\nlesson', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    await generateCoachingModuleContent(skill, 'math');
    expect(chatCompletion.mock.calls[0][2] as number).toBeGreaterThanOrEqual(12000);
  });
});

describe('generation completion budget (W-115 fix)', () => {
  it('requests a generous completion budget so the reasoning model does not truncate to empty', async () => {
    chatCompletion
      .mockResolvedValueOnce({ content: '## The idea\nlesson', usage: null })
      .mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    await generateCoachingModuleContent(skill, 'math');
    // Arg 3 (index 2) is maxTokens for the generation call. On gpt-5-mini this budget covers
    // reasoning + output; 3000 sat right at the edge and intermittently returned empty content.
    const genMaxTokens = chatCompletion.mock.calls[0][2] as number;
    expect(genMaxTokens).toBeGreaterThanOrEqual(8000);
  });
});

describe('verifyWorkedExamples', () => {
  it('returns warnings when the verifier reports not-ok', async () => {
    chatCompletion.mockResolvedValueOnce({ content: '{"ok":false,"warnings":["3+4 is 7, not 8"]}', usage: null });
    expect(await verifyWorkedExamples('content')).toEqual(['3+4 is 7, not 8']);
  });

  it('returns [] when the verifier reports ok', async () => {
    chatCompletion.mockResolvedValueOnce({ content: '{"ok":true,"warnings":[]}', usage: null });
    expect(await verifyWorkedExamples('content')).toEqual([]);
  });

  it('treats an unparseable verifier response as no warnings (fail open, admin still reviews)', async () => {
    chatCompletion.mockResolvedValueOnce({ content: 'the model rambled with no json', usage: null });
    expect(await verifyWorkedExamples('content')).toEqual([]);
  });
});
