import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { resolveScopeUserIds } from '../lib/scope';
import { computeWeeklyStreak } from '../lib/streak';

const router = Router();

const SESSION_GOAL = 5;
const STREAK_WEEKS_LOOKBACK = 60;

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return d;
}

// Generalised Monday-start bucketing (same rule as startOfWeek(), for any date) used to
// build the week-by-week attempt counts that computeWeeklyStreak() consumes.
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setHours(0, 0, 0, 0);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

function weekKey(d: Date): string {
  return mondayOf(d).toISOString().slice(0, 10);
}

// Sidebar momentum (L8): count queries only, so the UI never fetches full attempt
// lists just to count sessions. Demo attempts are excluded — loading demo data must
// not inflate the student's weekly ring. Scoped per caller (B1): students count their
// own sessions; admins their workspace, or one member via ?studentId=.
router.get('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const userIds = await resolveScopeUserIds(req, res);
  if (!userIds) return;

  const since = startOfWeek();
  const scope = { isDemo: false, finishedAt: { gte: since }, userId: { in: userIds } };
  const [writing, math] = await Promise.all([
    prisma.attempt.count({ where: scope }),
    prisma.mathAttempt.count({ where: scope }),
  ]);
  const sessionsThisWeek = writing + math;

  const currentWeekStart = startOfWeek();
  const lookbackStart = new Date(currentWeekStart);
  lookbackStart.setDate(lookbackStart.getDate() - STREAK_WEEKS_LOOKBACK * 7);
  const historyScope = { isDemo: false, finishedAt: { gte: lookbackStart }, userId: { in: userIds } };
  const [writingFinished, mathFinished] = await Promise.all([
    prisma.attempt.findMany({ where: historyScope, select: { finishedAt: true } }),
    prisma.mathAttempt.findMany({ where: historyScope, select: { finishedAt: true } }),
  ]);
  const countsByWeek = new Map<string, number>();
  for (const { finishedAt } of [...writingFinished, ...mathFinished]) {
    if (!finishedAt) continue;
    const key = weekKey(finishedAt);
    countsByWeek.set(key, (countsByWeek.get(key) ?? 0) + 1);
  }
  let oldestKeyWithData: string | null = null;
  for (const key of countsByWeek.keys()) {
    if (oldestKeyWithData === null || key < oldestKeyWithData) oldestKeyWithData = key;
  }
  const weeks: { count: number }[] = [];
  for (let i = 0; i < STREAK_WEEKS_LOOKBACK; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const key = weekKey(weekStart);
    weeks.push({ count: countsByWeek.get(key) ?? 0 });
    if (oldestKeyWithData !== null && key <= oldestKeyWithData) break;
  }
  const streakWeeks = computeWeeklyStreak(weeks, SESSION_GOAL, true);

  res.json({ sessionsThisWeek, streakWeeks });
}));

export default router;
