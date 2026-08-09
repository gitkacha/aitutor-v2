import { describe, it, expect } from 'vitest';
import { summarizeActionResult } from './chat.service';

// W-85: oversized action results must be capped before they're fed back to the model to narrate.
describe('summarizeActionResult', () => {
  it('passes small results through unchanged', () => {
    const r = { saved: true, worksheetId: 9, questionCount: 16 };
    expect(summarizeActionResult(r)).toBe(JSON.stringify(r));
  });

  it('truncates a huge result so it cannot blow the narration token budget', () => {
    const big = { questions: Array.from({ length: 200 }, (_, i) => ({ questionText: `Q${i} `.repeat(20) })) };
    const out = summarizeActionResult(big);
    expect(out.length).toBeLessThan(JSON.stringify(big).length);
    expect(out).toMatch(/truncated \d+ chars/);
  });
});
