import { describe, it, expect } from 'vitest';
import { generationDeadlineMs, isGenerationExpired } from './generation-poll';

// W-145: the admin generation poll had no deadline — a stuck job (e.g. a backend restart that
// dropped the in-memory job) left the button spinning "Generating…" indefinitely, then reset
// silently. A deadline scaled to the question count gives a clear "try again" instead.
describe('generationDeadlineMs', () => {
  it('scales with question count but stays generous for small jobs', () => {
    expect(generationDeadlineMs(5)).toBe(120_000 + 5 * 30_000); // 270s
    expect(generationDeadlineMs(21)).toBe(120_000 + 21 * 30_000); // 750s = 12.5 min
  });

  it('caps at 15 minutes so a wedged job cannot spin forever', () => {
    expect(generationDeadlineMs(100)).toBe(15 * 60_000);
  });

  it('treats a missing/undefined count as a safe default (not 0)', () => {
    expect(generationDeadlineMs(undefined)).toBeGreaterThanOrEqual(120_000);
  });
});

describe('isGenerationExpired', () => {
  it('is false while within the deadline', () => {
    const started = 1_000_000;
    expect(isGenerationExpired(started, started + 60_000, 5)).toBe(false);
  });

  it('is true once elapsed exceeds the count-scaled deadline', () => {
    const started = 1_000_000;
    const past = started + generationDeadlineMs(5) + 1;
    expect(isGenerationExpired(started, past, 5)).toBe(true);
  });
});
