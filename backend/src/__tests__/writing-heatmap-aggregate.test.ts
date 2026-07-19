import { describe, it, expect } from 'vitest';
import { aggregateWritingHeatmap } from '../lib/writing-heatmap-aggregate';

describe('aggregateWritingHeatmap (W-15)', () => {
  it('averages only analysed attempts and counts all attempts', () => {
    const [entry] = aggregateWritingHeatmap([
      {
        id: 1, name: 'Persuasive', slug: 'persuasive',
        attempts: [
          { analysis: { overallScore: 80 } },
          { analysis: { overallScore: 60 } },
          { analysis: null }, // pending — counts toward attemptCount, not the average
        ],
      },
    ]);
    expect(entry.averageScore).toBe(70);
    expect(entry.attemptCount).toBe(3);
  });

  it('reports null average for a type with no scored attempts', () => {
    const [entry] = aggregateWritingHeatmap([
      { id: 2, name: 'Review', slug: 'review', attempts: [{ analysis: null }] },
    ]);
    expect(entry.averageScore).toBeNull();
    expect(entry.attemptCount).toBe(1);
  });

  it('handles a type with no attempts', () => {
    const [entry] = aggregateWritingHeatmap([{ id: 3, name: 'Letter', slug: 'letter', attempts: [] }]);
    expect(entry).toMatchObject({ typeId: 3, typeName: 'Letter', typeSlug: 'letter', averageScore: null, attemptCount: 0 });
  });
});
