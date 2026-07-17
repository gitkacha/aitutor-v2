import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { analyzeAttempt } from '../services/ai.service';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.post('/:attemptId', asyncHandler(async (req: Request, res: Response) => {
  const attemptId = parseInt(req.params.attemptId);

  try {
    // Check if analysis already exists
    const existing = await prisma.analysis.findUnique({ where: { attemptId } });
    if (existing) {
      res.json(existing);
      return;
    }

    const result = await analyzeAttempt(attemptId);

    const analysis = await prisma.analysis.create({
      data: {
        attemptId,
        ...result,
      },
    });

    res.json(analysis);
  } catch (error: any) {
    if (error?.message === 'Attempt not found') {
      res.status(404).json({ error: 'Attempt not found', status: 404 });
      return;
    }
    // Concurrent triggers can race on the unique attemptId — return the winner's row.
    if (error?.code === 'P2002') {
      const existing = await prisma.analysis.findUnique({ where: { attemptId } });
      if (existing) {
        res.json(existing);
        return;
      }
    }
    // A failed analysis is never persisted — the next trigger retries cleanly.
    console.error('Analysis failed:', error);
    res.status(502).json({ error: `Analysis failed: ${error?.message || 'unknown error'}`, status: 502 });
  }
}));

export default router;
