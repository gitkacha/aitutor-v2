import { describe, it, expect } from 'vitest';
import { aggregateMathHeatmap } from '../lib/math-heatmap-aggregate';

// W-5: heatmap aggregation must parse each attempt's topicBreakdown once, not once
// per topic. These tests pin the aggregation behaviour so the O(attempts) rewrite
// stays identical to the route's previous output.

const topics = [
  { id: 1, name: 'Arithmetic', slug: 'arithmetic' },
  { id: 2, name: 'Probability', slug: 'probability' },
  { id: 3, name: 'Time', slug: 'time' },
];

describe('aggregateMathHeatmap', () => {
  it('averages per-topic percentages across attempts', () => {
    const attempts = [
      { topicBreakdown: JSON.stringify({ arithmetic: { correct: 3, total: 4 }, probability: { correct: 1, total: 2 } }) },
      { topicBreakdown: JSON.stringify({ arithmetic: { correct: 1, total: 4 } }) },
    ];
    const result = aggregateMathHeatmap(topics, attempts);

    const arithmetic = result.find((r) => r.topicSlug === 'arithmetic')!;
    expect(arithmetic.averageScore).toBe(50); // (75 + 25) / 2
    expect(arithmetic.attemptCount).toBe(2);

    const probability = result.find((r) => r.topicSlug === 'probability')!;
    expect(probability.averageScore).toBe(50);
    expect(probability.attemptCount).toBe(1);
  });

  it('untouched topics get a null score and zero attempts', () => {
    const result = aggregateMathHeatmap(topics, []);
    for (const entry of result) {
      expect(entry.averageScore).toBeNull();
      expect(entry.attemptCount).toBe(0);
    }
  });

  it('ignores empty breakdown entries (total 0) and unknown slugs', () => {
    const attempts = [
      { topicBreakdown: JSON.stringify({ time: { correct: 0, total: 0 }, 'not-a-topic': { correct: 5, total: 5 } }) },
    ];
    const result = aggregateMathHeatmap(topics, attempts);
    const time = result.find((r) => r.topicSlug === 'time')!;
    expect(time.averageScore).toBeNull();
    expect(time.attemptCount).toBe(0);
  });

  it('preserves topic identity fields in the output', () => {
    const result = aggregateMathHeatmap(topics, []);
    expect(result[0]).toMatchObject({ topicId: 1, topicName: 'Arithmetic', topicSlug: 'arithmetic' });
  });
});
