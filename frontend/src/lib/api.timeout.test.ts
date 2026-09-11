import { describe, it, expect } from 'vitest';
import { GENERATION_POLL_TIMEOUT_MS } from './api';

// W-121: lesson generation on gpt-5-mini takes ~85–95s (reasoning + 4–5k output tokens + verifier).
// The client poll deadline must sit comfortably above that so a normal generation never false-times
// out (the old 90s value bailed right as the job finished).
describe('GENERATION_POLL_TIMEOUT_MS', () => {
  it('is well above the observed ~90s generation time', () => {
    expect(GENERATION_POLL_TIMEOUT_MS).toBeGreaterThanOrEqual(180_000);
  });
});
