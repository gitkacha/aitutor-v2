// Deterministic answer-correctness guards (W-20), shared by generation and save so both
// paths reject the same unanswerable / self-contradictory questions for free.

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

// Compare options as values so `5/10` and `25/50` count as the same, not just identical
// strings. Non-numeric options fall back to case-insensitive text.
export function optionValue(option: string): string {
  const s = String(option).trim();
  const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(-?\d+(?:\.\d+)?)$/);
  if (frac) {
    const denominator = parseFloat(frac[2]);
    if (denominator !== 0) return (parseFloat(frac[1]) / denominator).toFixed(9);
  }
  const num = Number(s.replace(/,/g, ''));
  if (s !== '' && !Number.isNaN(num)) return num.toFixed(9);
  return s.toLowerCase();
}

// No two options may share a value — a repeated value makes the question ambiguous or
// unanswerable (the reported probability bug had 5/10 and 25/50 both equal to 1/2).
export function hasDistinctOptions(options: string[]): boolean {
  return new Set(options.map(optionValue)).size === options.length;
}

// When an explanation concludes by naming an option ("...the answer is Option C"), that
// option must be the keyed one. Explanations that don't name an option are not constrained.
export function explanationMatchesKey(explanation: string, correctIndex: number): boolean {
  const named = [...String(explanation).matchAll(/Option\s+([A-Za-z])/g)].map((m) => m[1].toUpperCase());
  if (named.length === 0) return true;
  return named[named.length - 1] === LETTERS[correctIndex];
}

// W-157: a question must reference its stimulus figure, never reproduce the figure's raw data in
// the question text. Catches the model serialising a table/dataset into the stem — an explicit
// "Columns:" / "Rows:" label followed by a bracket, or a bracketed array that starts with a quoted
// value (e.g. ["Robotics",50,55]). These patterns don't occur in a legitimate Year-6 word problem.
export function hasRawDataLeak(questionText: string): boolean {
  const t = String(questionText);
  if (/\b(columns|rows)\b\s*:\s*\[/i.test(t)) return true;
  if (/\[\s*"[^"]+"\s*,/.test(t)) return true;
  return false;
}

// Escalation decision (W-20): after a disagreeing first pass, two more independent solves
// run. Keep the question only if at least two of the three verdicts equal the claimed key
// and none is a "none of the options" / unparseable verdict (represented as negative).
export function keptByEscalation(verdicts: number[], key: number): boolean {
  if (verdicts.some((v) => v < 0)) return false;
  return verdicts.filter((v) => v === key).length >= 2;
}
