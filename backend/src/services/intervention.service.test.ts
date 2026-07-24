import { describe, it, expect } from 'vitest';
import { outcomeStatus } from './intervention.service';

// M3b Task 8: pure outcomeStatus logic. createIntervention / getInterventionOutcome need the
// DB + analytics service, so they're integration-tested by the Task 9 e2e, not unit-mocked here.

describe('outcomeStatus', () => {
  it('post-attempted < 8 → insufficient regardless of accuracy', () =>
    expect(outcomeStatus(0.4, 7, 0.99)).toBe('insufficient-evidence'));
  it('improving needs +10 points and ≥8 attempted', () => {
    expect(outcomeStatus(0.40, 8, 0.50)).toBe('improving'); // +10 exactly
    expect(outcomeStatus(0.40, 8, 0.4999)).toBe('not-yet-improving');
  });
});
