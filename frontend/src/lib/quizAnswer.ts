// W-120: tolerant answer matching for the interactive Guided Quiz. Students type short free-text
// answers, so we shouldn't penalise units, spacing, currency symbols, or an equivalent fraction vs
// decimal. Matching is deliberately lenient (this is a learning nudge, not a graded test); the
// generator can also supply `acceptable` variants, and there's always a "Show me" escape hatch.

// Unit words/symbols to ignore. `\b` boundaries keep single-letter units (m/s/h) from eating letters
// inside words — applied BEFORE whitespace is stripped so the boundaries still hold.
// Longer/compound units (km/h) come first so they win over the shorter alternatives (km).
const UNITS =
  /\b(km\/h|kmh|kph|mph|books?|people|persons?|students?|kilometres?|kilometers?|metres?|meters?|kms?|cms?|mms?|minutes?|mins?|seconds?|secs?|hours?|hrs?|dollars?|cents?|degrees?|m|s|h)\b/g;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[$£€]/g, '')
    .replace(/[%°]/g, '')
    .replace(UNITS, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '');
}

// Parse a plain number or a simple `a/b` fraction to a Number, else NaN.
function toNumber(s: string): number {
  const t = s
    .toLowerCase()
    .replace(/[$£€%°]/g, '')
    .replace(UNITS, '')
    .replace(/[,\s]/g, '');
  if (/^-?\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const frac = t.match(/^(-?\d+)\/(\d+)$/);
  if (frac) {
    const denom = parseInt(frac[2], 10);
    if (denom !== 0) return parseInt(frac[1], 10) / denom;
  }
  return NaN;
}

export function checkAnswer(input: string, answer: string, acceptable: string[] = []): boolean {
  if (!input || !input.trim()) return false;
  const inNorm = normalize(input);
  const inNum = toNumber(input);
  for (const candidate of [answer, ...acceptable]) {
    if (!candidate) continue;
    if (inNorm && inNorm === normalize(candidate)) return true;
    const cNum = toNumber(candidate);
    if (Number.isFinite(inNum) && Number.isFinite(cNum) && Math.abs(inNum - cNum) < 1e-9) return true;
  }
  return false;
}
