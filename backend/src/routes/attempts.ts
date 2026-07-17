import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { typeId, promptId, text, startedAt, finishedAt, timeTaken, source, worksheetId } = req.body;

  if (!typeId || !promptId || !text || !startedAt || !finishedAt || timeTaken === undefined) {
    res.status(400).json({ error: 'Missing required fields', status: 400 });
    return;
  }

  const attempt = await prisma.attempt.create({
    data: {
      typeId,
      promptId,
      text,
      startedAt: new Date(startedAt),
      finishedAt: new Date(finishedAt),
      timeTaken,
      source: source || 'practice',
      worksheetId: worksheetId || null,
    },
  });

  res.status(201).json(attempt);
}));

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { type } = req.query;
  const where = type
    ? { type: { slug: type as string } }
    : {};

  const attempts = await prisma.attempt.findMany({
    where,
    include: { analysis: true, type: true, prompt: true },
    orderBy: { finishedAt: 'desc' },
  });

  res.json(attempts);
}));

router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const attempt = await prisma.attempt.findUnique({
    where: { id: parseInt(req.params.id) },
    include: { analysis: true, type: true, prompt: true },
  });

  if (!attempt) {
    res.status(404).json({ error: 'Attempt not found', status: 404 });
    return;
  }

  res.json(attempt);
}));

export default router;
