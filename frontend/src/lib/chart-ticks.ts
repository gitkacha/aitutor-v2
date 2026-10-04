// W-150: inclusive y-axis ticks [0, step, 2*step, … yMax] for an explicit chart axis. Degrades to
// [0] when the step is unusable so a bad figure never throws in render.
export function gridTicks(yMax: number, step: number): number[] {
  if (!(step > 0) || !(yMax > 0)) return [0];
  const n = yMax / step;
  if (Math.abs(n - Math.round(n)) > 1e-9) return [0];
  return Array.from({ length: Math.round(n) + 1 }, (_, i) => Math.round(i * step * 1e6) / 1e6);
}

export interface ExplicitAxisProps {
  domain: [number, number];
  ticks: number[];
  allowDecimals: true;
  interval: 0;
}

// W-158: props to spread onto a Recharts <YAxis> for an explicit chart axis. `interval: 0` is the
// crucial bit — it forces Recharts to keep EVERY tick when generating the CartesianGrid, instead of
// its default 'preserveEnd' collision-thinning which can silently drop an interior gridline (e.g.
// 50) while the axis labels still show all ticks. Returns {} when the figure has no explicit axis,
// so auto-scaling behaviour is unchanged.
export function explicitAxisProps(yMax?: number, yTickStep?: number): ExplicitAxisProps | Record<string, never> {
  if (!yMax || !yTickStep) return {};
  return { domain: [0, yMax], ticks: gridTicks(yMax, yTickStep), allowDecimals: true, interval: 0 };
}
