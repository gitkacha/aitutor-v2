import { Router, Request, Response } from 'express';
import { loadDemoData, clearDemoData } from '../services/demo.service';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

router.post('/load', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await loadDemoData();
    res.json(result);
  } catch (error) {
    console.error('Failed to load demo data:', error);
    res.status(500).json({ error: 'Failed to load demo data', status: 500 });
  }
}));

router.post('/clear', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const result = await clearDemoData();
    res.json(result);
  } catch (error) {
    console.error('Failed to clear demo data:', error);
    res.status(500).json({ error: 'Failed to clear demo data', status: 500 });
  }
}));

export default router;
