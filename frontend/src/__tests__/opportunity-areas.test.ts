import { describe, it, expect } from 'vitest';
import { opportunityAreas } from '../lib/opportunity';
import type { HeatmapEntry, MathHeatmapEntry } from '../lib/api';

const w = (slug: string, score: number | null, n = 1): HeatmapEntry =>
  ({ typeId: 0, typeName: slug, typeSlug: slug, averageScore: score, attemptCount: n });
const m = (slug: string, score: number | null, n = 1): MathHeatmapEntry =>
  ({ topicId: 0, topicName: slug, topicSlug: slug, averageScore: score, attemptCount: n });

// Phase A / A4 (W-103): Opportunity Areas must rank Thinking Skills sections alongside Writing and
// Mathematics — the weakest scored areas across ALL subjects, linking to /math/<slug> for TS.
describe('opportunityAreas', () => {
  it('folds Thinking Skills entries into the weakest-4 ranking', () => {
    const areas = opportunityAreas(
      [w('persuasive', 90)],
      [m('arithmetic', 80)],
      [m('visual-reasoning', 30), m('logical-analysis', 55)],
    );
    const ts = areas.find((a) => a.label === 'visual-reasoning');
    expect(ts).toBeDefined();
    expect(ts!.path).toBe('/math/visual-reasoning');
    // Weakest first: the 30% Thinking Skills section leads.
    expect(areas[0].label).toBe('visual-reasoning');
    expect(areas.map((a) => a.label)).toContain('logical-analysis');
  });

  it('ignores areas with no attempts or no score, and caps at 4', () => {
    const areas = opportunityAreas(
      [],
      [],
      [
        m('a', 10), m('b', 20), m('c', 30), m('d', 40), m('e', 50),
        m('f', null, 3),   // scored null → excluded
        m('g', 15, 0),     // no attempts → excluded
      ],
    );
    expect(areas.length).toBe(4);
    expect(areas.map((a) => a.label)).toEqual(['a', 'b', 'c', 'd']);
  });
});
