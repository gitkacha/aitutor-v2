import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { analyzeAttempt } from '../services/ai.service';

const router = Router();

router.post('/:attemptId', async (req: Request, res: Response) => {
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
  } catch (error) {
    console.error('Analysis failed:', error);
    res.status(500).json({ error: 'Analysis failed', status: 500 });
  }
});

export default router;