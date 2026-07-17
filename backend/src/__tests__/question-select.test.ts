import { describe, it, expect } from 'vitest';
import { selectTestQuestions, MAX_TEST_QUESTIONS } from '../lib/question-select';

interface Q {
  id: number;
  stimulusGroupId: number | null;
}

// Synthetic bank: 50 questions — a 4-question group (g1), a 3-question group (g2),
// and 43 standalone questions.
function makeBank(): Q[] {
  const bank: Q[] = [];
  for (let i = 1; i <= 4; i++) bank.push({ id: i, stimulusGroupId: 1 });
  for (let i = 5; i <= 7; i++) bank.push({ id: i, stimulusGroupId: 2 });
  for (let i = 8; i <= 50; i++) bank.push({ id: i, stimulusGroupId: null });
  return bank;
}

function assertGroupsAdjacentAndWhole(selected: Q[], bank: Q[]) {
  const groupIds = new Set(selected.map((q) => q.stimulusGroupId).filter((g) => g != null));
  for (const gid of groupIds) {
    const positions = selected
      .map((q, i) => (q.stimulusGroupId === gid ? i : -1))
      .filter((i) => i >= 0);
    const groupSize = bank.filter((q) => q.stimulusGroupId === gid).length;
    expect(positions.length, `group ${gid} must be complete`).toBe(groupSize);
    expect(
      positions[positions.length - 1] - positions[0],
      `group ${gid} must be adjacent`
    ).toBe(positions.length - 1);
  }
}

describe('selectTestQuestions', () => {
  it('caps at MAX_TEST_QUESTIONS (35) when the bank is larger', () => {
    for (let run = 0; run < 20; run++) {
      const selected = selectTestQuestions(makeBank());
      expect(selected.length).toBe(MAX_TEST_QUESTIONS);
    }
  });

  it('keeps stimulus groups whole and adjacent, with no duplicates', () => {
    for (let run = 0; run < 20; run++) {
      const bank = makeBank();
      const selected = selectTestQuestions(bank);
      assertGroupsAdjacentAndWhole(selected, bank);
      expect(new Set(selected.map((q) => q.id)).size).toBe(selected.length);
    }
  });

  it('group members stay in id order within their block', () => {
    for (let run = 0; run < 20; run++) {
      const selected = selectTestQuestions(makeBank());
      const g1 = selected.filter((q) => q.stimulusGroupId === 1).map((q) => q.id);
      if (g1.length) expect(g1).toEqual([1, 2, 3, 4]);
    }
  });

  it('never overflows the cap even when only a group would fit', () => {
    // Bank: one 4-question group + 2 singles, cap 3 → group can never fit.
    const bank: Q[] = [
      { id: 1, stimulusGroupId: 9 }, { id: 2, stimulusGroupId: 9 },
      { id: 3, stimulusGroupId: 9 }, { id: 4, stimulusGroupId: 9 },
      { id: 5, stimulusGroupId: null }, { id: 6, stimulusGroupId: null },
    ];
    for (let run = 0; run < 20; run++) {
      const selected = selectTestQuestions(bank, 3);
      expect(selected.length).toBeLessThanOrEqual(3);
      expect(selected.every((q) => q.stimulusGroupId === null)).toBe(true);
    }
  });

  it('uncapped mode (cap: null) returns every question, groups still adjacent', () => {
    const bank = makeBank();
    const selected = selectTestQuestions(bank, null);
    expect(selected.length).toBe(bank.length);
    assertGroupsAdjacentAndWhole(selected, bank);
  });
});
