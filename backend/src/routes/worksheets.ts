import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';
import { asyncHandler } from '../lib/async-handler';

const router = Router();

// POST /api/worksheets/generate — generate prompts without saving (preview)
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { typeIds } = req.body;

  if (!typeIds || !Array.isArray(typeIds) || typeIds.length === 0) {
    res.status(400).json({ error: 'typeIds array is required', status: 400 });
    return;
  }

  try {
    const prompts = await generateWorksheetPrompts(typeIds);
    const types = await prisma.writingType.findMany({
      where: { id: { in: typeIds } },
      orderBy: { name: 'asc' },
    });

    res.json({
      types: types.map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
      prompts,
    });
  } catch (error) {
    console.error('Worksheet generation failed:', error);
    res.status(500).json({ error: 'Failed to generate worksheet', status: 500 });
  }
}));

// POST /api/worksheets/save — save an admin-reviewed worksheet
router.post('/save', asyncHandler(async (req: Request, res: Response) => {
  const { title, typeIds, prompts } = req.body;

  if (!title || !typeIds || !prompts) {
    res.status(400).json({ error: 'Missing required fields: title, typeIds, prompts', status: 400 });
    return;
  }

  try {
    const worksheet = await prisma.worksheet.create({
      data: {
        title,
        typeId: typeIds[0],
        prompts: JSON.stringify(prompts),
      },
    });

    res.status(201).json(worksheet);
  } catch (error) {
    console.error('Worksheet save failed:', error);
    res.status(500).json({ error: 'Failed to save worksheet', status: 500 });
  }
}));

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const worksheets = await prisma.worksheet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { attempts: { include: { analysis: true } } },
  });
  res.json(worksheets);
}));

// GET /api/worksheets/available/:typeId — get worksheets for a specific writing type
router.get('/available/:typeId', asyncHandler(async (req: Request, res: Response) => {
  const typeId = parseInt(req.params.typeId);
  if (isNaN(typeId)) {
    return res.status(400).json({ error: 'Invalid typeId', status: 400 });
  }

  const worksheets = await prisma.worksheet.findMany({
    where: { typeId },
    orderBy: { createdAt: 'desc' },
    include: {
      attempts: {
        select: { id: true, source: true, finishedAt: true, isDemo: true },
      },
    },
  });

  // Filter out worksheets where all attempts are demo (or show them? show them)
  res.json(worksheets);
}));

export default router;
