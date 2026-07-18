import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return d;
}

// Sidebar momentum (L8): count queries only, so the UI never fetches full attempt
// lists just to count sessions. Demo attempts are excluded — loading demo data must
// not inflate the student's weekly ring.
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const since = startOfWeek();
  const [writing, math] = await Promise.all([
    prisma.attempt.count({ where: { isDemo: false, finishedAt: { gte: since } } }),
    prisma.mathAttempt.count({ where: { isDemo: false, finishedAt: { gte: since } } }),
  ]);
  res.json({ sessionsThisWeek: writing + math });
}));

export default router;
