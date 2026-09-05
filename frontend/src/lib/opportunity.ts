import { HeatmapEntry, MathHeatmapEntry } from './api';

export interface Opportunity {
  key: string;
  label: string;
  score: number;
  path: string;
}

// The student's weakest scored areas across every subject (C2, extended for Thinking Skills in
// W-103) — where a bit of practice moves the needle most. Only areas with attempts and a score
// qualify. Writing links to /practice/<slug>; Mathematics and Thinking Skills both use /math/<slug>.
export function opportunityAreas(
  writing: HeatmapEntry[],
  math: MathHeatmapEntry[],
  thinking: MathHeatmapEntry[] = [],
): Opportunity[] {
  const scored = <T>(items: T[], pred: (d: T) => boolean) => items.filter(pred);

  const w: Opportunity[] = scored(writing, (d) => d.attemptCount > 0 && d.averageScore != null)
    .map((d) => ({ key: `w-${d.typeSlug}`, label: d.typeName, score: d.averageScore!, path: `/practice/${d.typeSlug}` }));
  const m: Opportunity[] = scored(math, (d) => d.attemptCount > 0 && d.averageScore != null)
    .map((d) => ({ key: `m-${d.topicSlug}`, label: d.topicName, score: d.averageScore!, path: `/math/${d.topicSlug}` }));
  const t: Opportunity[] = scored(thinking, (d) => d.attemptCount > 0 && d.averageScore != null)
    .map((d) => ({ key: `t-${d.topicSlug}`, label: d.topicName, score: d.averageScore!, path: `/math/${d.topicSlug}` }));

  return [...w, ...m, ...t].sort((a, b) => a.score - b.score).slice(0, 4);
}
