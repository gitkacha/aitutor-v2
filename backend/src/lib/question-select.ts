// Test-question selection (M2): questions sharing a stimulus group must appear as one
// adjacent block (like the real exam), and the mixed "All Topics" test is capped at 35.

export const MAX_TEST_QUESTIONS = 35;

interface GroupedQuestion {
  id: number;
  stimulusGroupId: number | null;
}

// Shuffles questions while keeping each stimulus group whole, adjacent and in id order,
// then greedily fills up to `cap` (null = no cap), skipping units that would overflow.
export function selectTestQuestions<T extends GroupedQuestion>(
  questions: T[],
  cap: number | null = MAX_TEST_QUESTIONS
): T[] {
  // Partition into units: one per stimulus group (members in id order), one per standalone.
  const byGroup = new Map<number, T[]>();
  const units: T[][] = [];
  for (const q of [...questions].sort((a, b) => a.id - b.id)) {
    if (q.stimulusGroupId == null) {
      units.push([q]);
    } else {
      let group = byGroup.get(q.stimulusGroupId);
      if (!group) {
        group = [];
        byGroup.set(q.stimulusGroupId, group);
        units.push(group);
      }
      group.push(q);
    }
  }

  // Fisher-Yates over units.
  for (let i = units.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [units[i], units[j]] = [units[j], units[i]];
  }

  const selected: T[] = [];
  for (const unit of units) {
    if (cap != null && selected.length + unit.length > cap) continue;
    selected.push(...unit);
    if (cap != null && selected.length === cap) break;
  }
  return selected;
}
