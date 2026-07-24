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
