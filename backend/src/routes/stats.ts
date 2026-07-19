import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { resolveScopeUserIds } from '../lib/scope';

const router = Router();

function startOfWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  return d;
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
  res.json({ sessionsThisWeek: writing + math });
}));

export default router;
