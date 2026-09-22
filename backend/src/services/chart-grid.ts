// W-151: code chooses the chart grid so generated charts are always readable. Pure numeric core —
// no model calls, no DB. "Clean" is defined in REAL units (axisValue * unit), so an axis in hundreds
// makes 0.5 (= 50) clean. Thirds and quarters are the only subdivisions that can be visually
// confused, so a grid where BOTH read clean is unsafe.
export const TOL = 1e-6;
export const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
export const approxEq = (a: number, b: number) => Math.abs(a - b) < TOL;

export const isMultiple = (v: number, m: number) => Math.abs(v / m - Math.round(v / m)) < TOL;

/** Position of v inside its grid interval, in [0, 1). */
export const fracInInterval = (v: number, G: number) => {
  const q = v / G;
  return round6(q - Math.floor(q + TOL));
};

/** A value sits on a gridline or exactly halfway. */
export const isEasyPosition = (frac: number) => approxEq(frac, 0) || approxEq(frac, 0.5);

export type Subdivision = 1 | 2 | 3 | 4;
export type Difficulty = 'easy' | 'medium' | 'hard';

export interface GridConfig {
  G: number;         // gridline step, in axis units
  d: Subdivision;    // subdivision of one grid interval
  yMax: number;      // top of y-axis, multiple of G
  unit: number;      // real units per axis unit (e.g. 100 for "hundreds")
  cleanStep: number; // smallest "clean" amount in real units (e.g. 1 or 25)
}

/** Is an axis value clean once converted to real units? */
export const isClean = (axisValue: number, unit: number, cleanStep: number) =>
  isMultiple(axisValue * unit, cleanStep);

/** Thirds and quarters are the only subdivisions that can be confused. */
export const rivalOf = (d: Subdivision): 3 | 4 | null => (d === 3 ? 4 : d === 4 ? 3 : null);

export function safeGridPairs(candidateGs: number[], unit: number, cleanStep: number): { G: number; d: Subdivision }[] {
  const pairs: { G: number; d: Subdivision }[] = [];
  for (const G of candidateGs) {
    for (const d of [1, 2, 3, 4] as Subdivision[]) {
      if (!isClean(G / d, unit, cleanStep)) continue;
      const rival = rivalOf(d);
      if (rival && isClean(G / rival, unit, cleanStep)) continue;
      pairs.push({ G, d });
    }
  }
  return pairs;
}

export function pickGrid(opts: {
  candidateGs: number[]; unit: number; cleanStep: number; difficulty: Difficulty;
  intervals?: [number, number]; rng?: () => number;
}): GridConfig {
  const { candidateGs, unit, cleanStep, difficulty, intervals = [4, 6], rng = Math.random } = opts;
  const wanted = (d: Subdivision) => (difficulty === 'easy' ? d <= 2 : d >= 3);
  const pool = safeGridPairs(candidateGs, unit, cleanStep).filter((p) => wanted(p.d));
  if (!pool.length) throw new Error('No safe grid for these candidates/difficulty');
  const { G, d } = pool[Math.floor(rng() * pool.length)];
  const n = intervals[0] + Math.floor(rng() * (intervals[1] - intervals[0] + 1));
  return { G, d, yMax: G * n, unit, cleanStep };
}

/** Inclusive gridline ticks [0 … yMax]. */
export const gridTicks = (yMax: number, G: number): number[] =>
  Array.from({ length: Math.round(yMax / G) + 1 }, (_, i) => round6(i * G));

/** Coarsest subdivision (1–4) that places every value; null if none works. */
export function inferSubdivision(G: number, values: number[]): Subdivision | null {
  for (const d of [1, 2, 3, 4] as Subdivision[]) {
    if (values.every((v) => isMultiple(v, G / d))) return d;
  }
  return null;
}

/** Values readable as a third OR a quarter where the rival reading is also clean. */
export function ambiguousValues(values: number[], cfg: GridConfig): number[] {
  return values.filter((v) => {
    const frac = fracInInterval(v, cfg.G);
    if (isEasyPosition(frac)) return false;
    const base = Math.floor(round6(v / cfg.G)); // exact interval index (round6 removes the drift before floor)
    return ([3, 4] as const).some((k) => {
      const alt = Math.round(frac * k) / k;
      if (approxEq(alt, frac) || Math.abs(alt - frac) >= 0.1) return false;
      const altValue = round6((base + alt) * cfg.G);
      return isClean(altValue, cfg.unit, cfg.cleanStep);
    });
  });
}
