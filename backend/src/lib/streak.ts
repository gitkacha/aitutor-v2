// weeks[0] is the current (most-recent) week, weeks[1] the prior, …
export function computeWeeklyStreak(weeks: { count: number }[], goal: number, currentInProgress: boolean): number {
  let start = (currentInProgress && (weeks[0]?.count ?? 0) < goal) ? 1 : 0;
  let streak = 0;
  for (let i = start; i < weeks.length; i++) {
    if (weeks[i].count >= goal) streak++;
    else break;
  }
  return streak;
}
