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
