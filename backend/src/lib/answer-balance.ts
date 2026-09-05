// W-104: the generation model strongly favours putting the correct answer first (observed 11/15 at
// option A). This rebalances the correct-answer POSITION across a generated worksheet so there's no
// discernible pattern — without disturbing the option set, distinctness, stimulus, or skill tags,
// and keeping any "Option X" letter references in the explanation consistent with the new key.

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export interface BalanceableQuestion {
  options: string[];
  correctIndex: number;
  explanation: string;
}

function shuffleInPlace<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Remap "Option X" letter references through an old→new index map so an explanation that names an
// option still points at the same physical choice after a swap. Content-only explanations (no
// "Option X") pass through unchanged.
function remapExplanationLetters(explanation: string, map: number[], optionCount: number): string {
  return String(explanation).replace(/Option\s+([A-Za-z])/g, (whole, letter: string) => {
    const oldIdx = LETTERS.indexOf(letter.toUpperCase());
    if (oldIdx < 0 || oldIdx >= optionCount || map[oldIdx] === undefined) return whole;
    return `Option ${LETTERS[map[oldIdx]]}`;
  });
}

// Distribute the correct-answer positions evenly (and in shuffled order) across a worksheet, in
// place. `optionCount` is the intended per-question option count; each question also respects its
// own actual option array length as a safety net. `rng` is injectable for deterministic tests.
export function balanceAnswerPositions<T extends BalanceableQuestion>(
  questions: T[],
  optionCount: number,
  rng: () => number = Math.random,
): T[] {
  if (optionCount < 2) return questions;

  // A balanced multiset of target positions (each slot used ~equally), then shuffled so the
  // sequence carries no A,B,C,D… regularity.
  const targets = questions.map((_, i) => i % optionCount);
  shuffleInPlace(targets, rng);

  questions.forEach((q, i) => {
    if (!Array.isArray(q.options) || q.options.length < 2) return;
    const oc = q.options.length;
    const from = q.correctIndex;
    if (from < 0 || from >= oc) return;
    const to = targets[i] % oc;
    if (to === from) return;

    // Swap the correct option into its target slot; whatever sat there takes the old slot.
    [q.options[from], q.options[to]] = [q.options[to], q.options[from]];

    const map = Array.from({ length: oc }, (_, k) => k);
    map[from] = to;
    map[to] = from;
    q.explanation = remapExplanationLetters(q.explanation, map, oc);
    q.correctIndex = to;
  });

  return questions;
}
