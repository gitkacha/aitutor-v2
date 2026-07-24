export interface AnswerRecord {
  attemptId: number; finishedAt: string; // ISO
  skillSlug: string; skillName: string;
  correct: boolean; chosenIndex: number | null; chosenOptionText: string | null;
  timeMs: number | null; flagged: boolean; answerChanges: number;
  positionIndex: number; attemptSize: number;
}

export interface SkillSignal {
  slug: string; name: string; attempted: number; correct: number; accuracy: number;
  sufficientEvidence: boolean; meanTimeMs: number | null; slow: boolean | null;
  fastWrong: number | null; slowWrong: number | null;
  misconception: { optionIndex: number; share: number; optionText: string | null } | null;
  trendPts: number | null; stabilitySd: number | null;
  flaggedWrong: number; flaggedRight: number; answerChangeHelpRate: number | null;
  cohortAccuracy?: number;
}

export const EVIDENCE_FLOOR = 8;
export const EXAM_ANCHOR_MS = 68600;

export function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function popStdDev(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
}

export function splitAttemptHalves(records: AnswerRecord[]) {
  const seen = new Map<number, string>();
  for (const r of records) if (!seen.has(r.attemptId)) seen.set(r.attemptId, r.finishedAt);
  const ordered = [...seen.entries()].sort((a, b) =>
    a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] - b[0]);
  const olderCount = Math.ceil(ordered.length / 2);
  return { older: new Set(ordered.slice(0, olderCount).map(([id]) => id)),
           newer: new Set(ordered.slice(olderCount).map(([id]) => id)) };
}

export function positionThird(positionIndex: number, attemptSize: number): 'first' | 'middle' | 'final' {
  const firstCount = Math.ceil(attemptSize / 3);
  const lastCount = Math.min(firstCount, attemptSize - firstCount);
  if (positionIndex < firstCount) return 'first';
  if (positionIndex >= attemptSize - lastCount) return 'final';
  return 'middle';
}

export function computeSkillSignals(records: AnswerRecord[], medianMs: number | null): SkillSignal[] {
  const groups = new Map<string, AnswerRecord[]>();
  for (const r of records) {
    if (!groups.has(r.skillSlug)) groups.set(r.skillSlug, []);
    groups.get(r.skillSlug)!.push(r);
  }

  const signals: SkillSignal[] = [];
  for (const [slug, recs] of groups) {
    const attempted = recs.length;
    const correct = recs.filter((r) => r.correct).length;
    const accuracy = correct / attempted;
    const sufficientEvidence = attempted >= EVIDENCE_FLOOR;

    const timed = recs.filter((r) => r.timeMs != null);
    const meanTimeMs = timed.length > 0
      ? timed.reduce((a, r) => a + r.timeMs!, 0) / timed.length
      : null;
    const slow = meanTimeMs == null || medianMs == null
      ? null
      : meanTimeMs > Math.max(1.5 * medianMs, EXAM_ANCHOR_MS);

    const answeredWrong = recs.filter((r) => r.chosenIndex != null && !r.correct);
    let fastWrong: number | null = null;
    let slowWrong: number | null = null;
    if (medianMs != null) {
      const timedWrong = answeredWrong.filter((r) => r.timeMs != null);
      fastWrong = timedWrong.filter((r) => r.timeMs! < 0.6 * medianMs).length;
      slowWrong = timedWrong.filter((r) => r.timeMs! > 1.5 * medianMs).length;
    }

    let misconception: SkillSignal['misconception'] = null;
    if (answeredWrong.length >= 4) {
      const counts = new Map<number, number>();
      for (const r of answeredWrong) {
        const idx = r.chosenIndex!;
        counts.set(idx, (counts.get(idx) ?? 0) + 1);
      }
      let modalIndex: number | null = null;
      let modalCount = 0;
      for (const [idx, count] of [...counts.entries()].sort((a, b) => a[0] - b[0])) {
        if (count > modalCount) { modalCount = count; modalIndex = idx; }
      }
      const share = modalCount / answeredWrong.length;
      if (modalIndex != null && share >= 0.5) {
        const first = answeredWrong.find((r) => r.chosenIndex === modalIndex)!;
        misconception = { optionIndex: modalIndex, share, optionText: first.chosenOptionText };
      }
    }

    // trend: split the skill's own records into older/newer halves by attempt, compare accuracy
    let trendPts: number | null = null;
    {
      const { older, newer } = splitAttemptHalves(recs);
      const olderRecs = recs.filter((r) => older.has(r.attemptId));
      const newerRecs = recs.filter((r) => newer.has(r.attemptId));
      if (olderRecs.length >= 4 && newerRecs.length >= 4) {
        const olderAcc = olderRecs.filter((r) => r.correct).length / olderRecs.length;
        const newerAcc = newerRecs.filter((r) => r.correct).length / newerRecs.length;
        trendPts = (newerAcc - olderAcc) * 100;
      }
    }

    // stability: population SD of per-attempt accuracy, over attempts with >= 2 skill questions
    let stabilitySd: number | null = null;
    {
      const byAttempt = new Map<number, AnswerRecord[]>();
      for (const r of recs) {
        if (!byAttempt.has(r.attemptId)) byAttempt.set(r.attemptId, []);
        byAttempt.get(r.attemptId)!.push(r);
      }
      const accuracies: number[] = [];
      for (const group of byAttempt.values()) {
        if (group.length < 2) continue;
        accuracies.push(group.filter((r) => r.correct).length / group.length);
      }
      stabilitySd = popStdDev(accuracies);
    }

    // flags
    const flaggedWrong = recs.filter((r) => r.flagged && !r.correct).length;
    const flaggedRight = recs.filter((r) => r.flagged && r.correct).length;

    // answer-change help rate
    let answerChangeHelpRate: number | null = null;
    {
      const changed = recs.filter((r) => r.answerChanges >= 1);
      answerChangeHelpRate = changed.length > 0
        ? changed.filter((r) => r.correct).length / changed.length
        : null;
    }

    signals.push({
      slug, name: recs[0].skillName, attempted, correct, accuracy, sufficientEvidence,
      meanTimeMs, slow, fastWrong, slowWrong, misconception,
      trendPts, stabilitySd,
      flaggedWrong, flaggedRight, answerChangeHelpRate,
    });
  }

  return signals.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
}

export interface PacingThird {
  total: number; correct: number; accuracy: number | null;
  unanswered: number; unansweredRate: number | null;
}

export function computePacingCurve(records: AnswerRecord[]): { first: PacingThird; middle: PacingThird; final: PacingThird } {
  const buckets: Record<'first' | 'middle' | 'final', { total: number; correct: number; unanswered: number }> = {
    first: { total: 0, correct: 0, unanswered: 0 },
    middle: { total: 0, correct: 0, unanswered: 0 },
    final: { total: 0, correct: 0, unanswered: 0 },
  };

  for (const r of records) {
    const third = positionThird(r.positionIndex, r.attemptSize);
    const b = buckets[third];
    b.total += 1;
    if (r.correct) b.correct += 1;
    if (r.chosenIndex == null) b.unanswered += 1;
  }

  const toThird = (b: { total: number; correct: number; unanswered: number }): PacingThird => ({
    total: b.total, correct: b.correct,
    accuracy: b.total ? b.correct / b.total : null,
    unanswered: b.unanswered,
    unansweredRate: b.total ? b.unanswered / b.total : null,
  });

  return { first: toThird(buckets.first), middle: toThird(buckets.middle), final: toThird(buckets.final) };
}

export function computeCohortAccuracy(perStudent: Map<number, SkillSignal[]>): Map<string, number> {
  const bySlug = new Map<string, number[]>();
  for (const signals of perStudent.values()) {
    for (const s of signals) {
      if (s.attempted < EVIDENCE_FLOOR) continue;
      if (!bySlug.has(s.slug)) bySlug.set(s.slug, []);
      bySlug.get(s.slug)!.push(s.accuracy);
    }
  }

  const result = new Map<string, number>();
  for (const [slug, accuracies] of bySlug) {
    if (accuracies.length >= 5) {
      result.set(slug, accuracies.reduce((a, b) => a + b, 0) / accuracies.length);
    }
  }
  return result;
}

export function rankOpportunityAreas(signals: SkillSignal[]): SkillSignal[] {
  return signals
    .filter((s) => s.sufficientEvidence)
    .sort((a, b) => {
      if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
      return (a.trendPts ?? 0) - (b.trendPts ?? 0);
    });
}

// Writing's opportunity ranking: same shape of rule as rankOpportunityAreas but keyed on
// `mean` (writing has no `accuracy`) — sufficient-evidence only, ascending by mean, ties
// broken by worse (more negative) trendPts first with null coalesced to 0. Generic over any
// shape carrying these three fields so the adapter's WritingSkillSignal (which also carries
// `slug`/`name`/`n`) can be ranked without the core depending on that adapter-only type.
export function rankWritingOpportunityAreas<
  T extends { mean: number; trendPts: number | null; sufficientEvidence: boolean }
>(signals: T[]): T[] {
  return signals
    .filter((s) => s.sufficientEvidence)
    .sort((a, b) => a.mean - b.mean || (a.trendPts ?? 0) - (b.trendPts ?? 0));
}

export interface WritingAnalysisRecord {
  finishedAt: string; // ISO
  criteriaScores: Record<string, number> | null;
}

export function computeWritingSignals(
  records: WritingAnalysisRecord[],
): { slug: string; mean: number; trendPts: number | null; n: number }[] {
  const valid = records.filter((r) => r.criteriaScores != null);

  const indexed = valid.map((r, i) => ({ r, i }));
  const sortedByFinish = [...indexed].sort((a, b) =>
    a.r.finishedAt < b.r.finishedAt ? -1 : a.r.finishedAt > b.r.finishedAt ? 1 : a.i - b.i);

  const slugs = new Set<string>();
  for (const r of valid) for (const slug of Object.keys(r.criteriaScores!)) slugs.add(slug);

  const results: { slug: string; mean: number; trendPts: number | null; n: number }[] = [];
  for (const slug of slugs) {
    const containing = valid.filter((r) => slug in r.criteriaScores!);
    const n = containing.length;
    const mean = containing.reduce((a, r) => a + r.criteriaScores![slug], 0) / n;

    const sortedContaining = sortedByFinish.filter((x) => slug in x.r.criteriaScores!);
    const olderCount = Math.ceil(sortedContaining.length / 2);
    const older = sortedContaining.slice(0, olderCount);
    const newer = sortedContaining.slice(olderCount);

    let trendPts: number | null = null;
    if (older.length >= 2 && newer.length >= 2) {
      const olderMean = older.reduce((a, x) => a + x.r.criteriaScores![slug], 0) / older.length;
      const newerMean = newer.reduce((a, x) => a + x.r.criteriaScores![slug], 0) / newer.length;
      trendPts = newerMean - olderMean;
    }

    results.push({ slug, mean, trendPts, n });
  }
  return results;
}
