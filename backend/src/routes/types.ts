import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  const types = await prisma.writingType.findMany({
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.get('/:slug', async (req: Request, res: Response) => {
  const type = await prisma.writingType.findUnique({
    where: { slug: req.params.slug },
    include: { prompts: true },
  });
  if (!type) {
    res.status(404).json({ error: 'Writing type not found', status: 404 });
    return;
  }
  res.json(type);
});

export default router;