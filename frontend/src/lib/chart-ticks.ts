// W-150: inclusive y-axis ticks [0, step, 2*step, … yMax] for an explicit chart axis. Degrades to
// [0] when the step is unusable so a bad figure never throws in render.
export function gridTicks(yMax: number, step: number): number[] {
  if (!(step > 0) || !(yMax > 0)) return [0];
  const n = yMax / step;
  if (Math.abs(n - Math.round(n)) > 1e-9) return [0];
  return Array.from({ length: Math.round(n) + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
}
