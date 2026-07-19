// Writing heatmap aggregation (extracted for W-15 so the per-student route and the
// super-admin per-workspace oversight share one implementation). Mirrors the math
// aggregator in shape.

interface AttemptWithAnalysis {
  analysis: { overallScore: number | null } | null;
}

interface TypeWithAttempts {
  id: number;
  name: string;
  slug: string;
  attempts: AttemptWithAnalysis[];
}

export interface WritingHeatmapEntry {
  typeId: number;
  typeName: string;
  typeSlug: string;
  averageScore: number | null;
  attemptCount: number;
}

export function aggregateWritingHeatmap(types: TypeWithAttempts[]): WritingHeatmapEntry[] {
  return types.map((type) => {
    const scored = type.attempts.filter((a) => a.analysis?.overallScore != null);
    const averageScore =
      scored.length > 0
        ? Math.round(scored.reduce((sum, a) => sum + a.analysis!.overallScore!, 0) / scored.length)
        : null;
    return {
      typeId: type.id,
      typeName: type.name,
      typeSlug: type.slug,
      averageScore,
      attemptCount: type.attempts.length,
    };
  });
}
