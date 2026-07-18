import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const { typeId, promptId, text, startedAt, finishedAt, timeTaken, source, worksheetId } = req.body;

  // `text` may legitimately be an empty string — a timed-out attempt with nothing written.
  // A worksheet attempt needs no promptId: the worksheet's own prompt is resolved below (H4).
  if (!typeId || (!promptId && !worksheetId) || typeof text !== 'string' || !startedAt || !finishedAt || timeTaken == null) {
    res.status(400).json({ error: 'Missing required fields', status: 400 });
    return;
  }

  let resolvedTypeId = typeId;
  let resolvedPromptId = promptId;
  if (worksheetId) {
    // The attempt must reference the prompt the student actually answered — the
    // worksheet's generated prompt, not a bank prompt (H4). Find-or-create keeps one
    // Prompt row per worksheet prompt text and covers worksheets saved before H4.
    const worksheet = await prisma.worksheet.findUnique({ where: { id: worksheetId } });
    if (!worksheet) {
      res.status(400).json({ error: 'Worksheet not found', status: 400 });
      return;
    }
    let promptText = '';
    try {
      promptText = (JSON.parse(worksheet.prompts || '[]')[0] as string) || '';
    } catch {
      promptText = '';
    }
    if (!promptText) {
      res.status(400).json({ error: 'Worksheet has no prompt', status: 400 });
      return;
    }
    const existing = await prisma.prompt.findFirst({
      where: { typeId: worksheet.typeId, text: promptText },
    });
    const prompt = existing ?? (await prisma.prompt.create({
      data: { typeId: worksheet.typeId, text: promptText, source: 'worksheet' },
    }));
    resolvedTypeId = worksheet.typeId;
    resolvedPromptId = prompt.id;
  }

  const attempt = await prisma.attempt.create({
    data: {
      // Attempts belong to the session user (Milestone 2 Phase A); full read-scoping
      // lands in Phase B1.
      userId: req.user!.id,
      typeId: resolvedTypeId,
      promptId: resolvedPromptId,
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
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid attempt ID', status: 400 });
    return;
  }
  const attempt = await prisma.attempt.findUnique({
    where: { id },
    include: { analysis: true, type: true, prompt: true },
  });

  if (!attempt) {
    res.status(404).json({ error: 'Attempt not found', status: 404 });
    return;
  }

  res.json(attempt);
}));

export default router;
