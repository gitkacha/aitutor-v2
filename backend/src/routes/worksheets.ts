import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { generateWorksheetPrompts } from '../services/ai.service';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';

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
router.post('/save', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { title, typeIds, prompts } = req.body;

  if (!title || !Array.isArray(typeIds) || typeIds.length === 0 || !Array.isArray(prompts)) {
    res.status(400).json({ error: 'Missing required fields: title, typeIds, prompts', status: 400 });
    return;
  }

  try {
    // A writing attempt is always a single text type, so a multi-type selection becomes one
    // worksheet per type (H3). prompts[i] belongs to types[i], both sorted by name — the
    // order /generate returned them in.
    const types = await prisma.writingType.findMany({
      where: { id: { in: typeIds } },
      orderBy: { name: 'asc' },
    });

    // One prompt per resolved type — a mismatch means a bad request, never a silent
    // duplication of prompts[0] (L14).
    if (types.length === 0 || types.length !== prompts.length) {
      res.status(400).json({ error: 'typeIds and prompts must resolve to the same count', status: 400 });
      return;
    }

    const worksheets = await Promise.all(
      types.map(async (type, i) => {
        const promptText = prompts[i];
        const worksheet = await prisma.worksheet.create({
          data: {
            // Tenant scoping (Milestone 2 Phase A): worksheets belong to the creator's
            // workspace; the assignment picker lands in Phase C1.
            workspaceId: req.user!.workspaceId,
            createdById: req.user!.id,
            title: types.length === 1 ? title : `Worksheet: ${type.name}`,
            typeId: type.id,
            prompts: JSON.stringify([promptText]),
          },
        });
        // The worksheet's prompt is a real Prompt row so attempts reference the task the
        // student actually answers and the analysis grades against it (H4).
        await prisma.prompt.create({
          data: { typeId: type.id, text: promptText, source: 'worksheet' },
        });
        return worksheet;
      })
    );

    res.status(201).json(worksheets);
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
