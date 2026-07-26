// W-82: a math attempt's score FOR a specific topic, read from its stored `topicBreakdown`
// (`{ "<slug>": { correct, total } }`). Worksheet and all-topics attempts (topicId null) touch a
// topic through this breakdown, so topic-scoped views must score them per-topic — matching the
// heatmap — rather than using the whole-attempt score. Falls back to the whole-attempt score when
// the slug isn't present (e.g. a single-topic practice attempt viewed on its own topic).
export function topicScore(
  attempt: { topicBreakdown: string; score: number; totalQuestions: number },
  slug: string,
): { correct: number; total: number; percent: number } {
  try {
    const breakdown = JSON.parse(attempt.topicBreakdown) as Record<string, { correct: number; total: number }>;
    const entry = breakdown?.[slug];
    if (entry && typeof entry.total === 'number' && entry.total > 0) {
      return { correct: entry.correct, total: entry.total, percent: Math.round((entry.correct / entry.total) * 100) };
    }
  } catch {
    /* fall through */
  }
  return {
    correct: attempt.score,
    total: attempt.totalQuestions,
    percent: attempt.totalQuestions > 0 ? Math.round((attempt.score / attempt.totalQuestions) * 100) : 0,
  };
}
