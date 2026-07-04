import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';

const router = Router();

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
    });

    const title = `Worksheet: ${types.map((t) => t.name).join(' + ')}`;

    const worksheet = await prisma.worksheet.create({
      data: {
        title,
        typeId: typeIds[0],
        prompts: JSON.stringify(prompts),
      },
    });

    res.status(201).json(worksheet);
  } catch (error) {
    console.error('Worksheet generation failed:', error);
    res.status(500).json({ error: 'Failed to generate worksheet', status: 500 });
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