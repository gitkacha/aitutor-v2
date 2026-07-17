// Math heatmap aggregation (W-5): parse each attempt's topicBreakdown exactly once and
// aggregate in a single pass — the route previously re-parsed every attempt per topic.

interface TopicRow {
  id: number;
  name: string;
  slug: string;
}

interface AttemptRow {
  topicBreakdown: string;
}

export interface MathHeatmapEntry {
  topicId: number;
  topicName: string;
  topicSlug: string;
  averageScore: number | null;
  attemptCount: number;
}

export function aggregateMathHeatmap(topics: TopicRow[], attempts: AttemptRow[]): MathHeatmapEntry[] {
  const scoresBySlug = new Map<string, number[]>(topics.map((t) => [t.slug, []]));

  for (const attempt of attempts) {
    let breakdown: Record<string, { correct: number; total: number }>;
    try {
      breakdown = JSON.parse(attempt.topicBreakdown);
    } catch {
      continue;
    }
    for (const [slug, entry] of Object.entries(breakdown)) {
      const scores = scoresBySlug.get(slug);
      if (scores && entry && entry.total > 0) {
        scores.push(Math.round((entry.correct / entry.total) * 100));
      }
    }
  }

  return topics.map((topic) => {
    const scores = scoresBySlug.get(topic.slug)!;
    return {
      topicId: topic.id,
      topicName: topic.name,
      topicSlug: topic.slug,
      averageScore: scores.length > 0
        ? Math.round(scores.reduce((sum, s) => sum + s, 0) / scores.length)
        : null,
      attemptCount: scores.length,
    };
  });
}
