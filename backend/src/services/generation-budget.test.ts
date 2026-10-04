import { describe, it, expect } from 'vitest';
import { generationTokenBudget } from './ai.service';

// W-143: gpt-5-mini is a reasoning model — hidden reasoning tokens count against the completion
// budget. The old budget (count*600+4000) was consumed by reasoning alone on the heavier briefed
// prompts, so the model returned empty content and the batch retry-stormed. Measured: a 10-question
// briefed batch uses ~12.4k completion tokens, so the budget must be well above the visible-JSON size.
describe('generationTokenBudget', () => {
  it('gives a 5-question batch enough headroom (proven reliable at 12000)', () => {
    expect(generationTokenBudget(5)).toBe(12000);
  });

  it('gives a full 10-question batch headroom (proven reliable at 18000)', () => {
    expect(generationTokenBudget(10)).toBe(18000);
  });

  it('caps a single call at 24000 tokens', () => {
    expect(generationTokenBudget(15)).toBe(24000); // 15*1200+6000 = 24000 exactly
    expect(generationTokenBudget(30)).toBe(24000); // would be 42000, capped
  });

  it('is strictly larger than the old budget at every batch size', () => {
    for (const n of [1, 5, 10, 15, 30]) {
      const old = Math.min(n * 600 + 4000, 16000);
      expect(generationTokenBudget(n)).toBeGreaterThan(old);
    }
  });
});
