import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin } from '../middleware/auth';

const router = Router();

// M3a: the full skill taxonomy (math skills joined to their topic, writing skills with
// topicSlug null). Admin-only — skills drive worksheet targeting and reporting, not the
// student-facing practice flow.
router.get('/', requireAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const skills = await prisma.skill.findMany({
    orderBy: [{ subject: 'asc' }, { id: 'asc' }],
    include: { topic: { select: { slug: true } } },
  });
  res.json(skills.map(({ topic, ...s }) => ({ ...s, topicSlug: topic?.slug ?? null })));
}));

export default router;
