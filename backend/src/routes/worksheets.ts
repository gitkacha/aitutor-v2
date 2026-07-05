import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';

const router = Router();

// POST /api/worksheets/generate — generate prompts without saving (preview)
router.post('/generate', async (req: Request, res: Response) => {
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
});

// POST /api/worksheets/save — save an admin-reviewed worksheet
router.post('/save', async (req: Request, res: Response) => {
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
});

router.get('/', async (_req: Request, res: Response) => {
  const worksheets = await prisma.worksheet.findMany({
    orderBy: { createdAt: 'desc' },
    include: { attempts: { include: { analysis: true } } },
  });
  res.json(worksheets);
});

export default router;