// W-145: worksheet generation runs as a background job the admin polls. A briefed reasoning-model
// worksheet legitimately takes a few minutes, but a job that never finishes (e.g. the backend was
// restarted and dropped the in-memory job) used to leave the button spinning forever and then reset
// with no explanation. These helpers give the poll a deadline scaled to the question count.

const BASE_MS = 120_000; // 2 min of fixed overhead (start-up, verification, top-up calls)
const PER_QUESTION_MS = 30_000; // budget per requested question
const MAX_MS = 15 * 60_000; // hard ceiling — nothing legitimate should take longer

/** How long to wait for a generation of `questionCount` questions before giving up. */
export function generationDeadlineMs(questionCount?: number): number {
  const n = typeof questionCount === 'number' && questionCount > 0 ? questionCount : 35;
  return Math.min(BASE_MS + n * PER_QUESTION_MS, MAX_MS);
}

/** True once the poll has run past the count-scaled deadline and should stop with a message. */
export function isGenerationExpired(startedAt: number, now: number, questionCount?: number): boolean {
  return now - startedAt > generationDeadlineMs(questionCount);
}
