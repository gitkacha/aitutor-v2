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

    signals.push({
      slug, name: recs[0].skillName, attempted, correct, accuracy, sufficientEvidence,
      meanTimeMs, slow, fastWrong, slowWrong, misconception,
      trendPts: null, stabilitySd: null,
      flaggedWrong: 0, flaggedRight: 0, answerChangeHelpRate: null,
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
