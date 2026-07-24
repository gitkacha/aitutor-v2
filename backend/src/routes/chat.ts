// M3b Task 9: the admin coach-chat HTTP surface. Every route is admin-only and workspace-scoped
// (a session belongs to the caller's workspace). The heavy lifting — the grounded tool loop and
// confirmation gating — lives in chat.service; these handlers just authenticate, scope, and
// translate the service's "not found" errors into 404s.
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin } from '../middleware/auth';
import { runChatStep, resolvePendingAction } from '../services/chat.service';
import type { ToolContext } from '../services/chat-tools';

const router = Router();

const DEFAULT_TITLE = 'New chat';

// Errors the service throws when a session or parked action isn't in scope map to 404 —
// an out-of-workspace session must be indistinguishable from a missing one.
const NOT_FOUND_MESSAGES = new Set(['Chat session not found', 'Pending action not found']);

function ctxFor(req: Request, sessionId: number): ToolContext {
  return { workspaceId: req.user!.workspaceId, adminId: req.user!.id, sessionId };
}

// Load a session and confirm it belongs to the caller's workspace; 404 otherwise.
async function loadOwnedSession(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(404).json({ error: 'Chat session not found' });
    return null;
  }
  const session = await prisma.chatSession.findUnique({ where: { id } });
  if (!session || session.workspaceId !== req.user!.workspaceId) {
    res.status(404).json({ error: 'Chat session not found' });
    return null;
  }
  return session;
}

// POST /api/chat/sessions — open a new (empty) chat.
router.post('/sessions', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const session = await prisma.chatSession.create({
    data: { workspaceId: req.user!.workspaceId, adminId: req.user!.id, title: DEFAULT_TITLE },
  });
  res.status(201).json({ id: session.id });
}));

// GET /api/chat/sessions — the workspace's chats, newest first.
router.get('/sessions', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const sessions = await prisma.chatSession.findMany({
    where: { workspaceId: req.user!.workspaceId },
    orderBy: { id: 'desc' },
    select: { id: true, title: true, createdAt: true },
  });
  res.json(sessions);
}));

// GET /api/chat/sessions/:id — one chat with its full message transcript.
router.get('/sessions/:id', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req, res);
  if (!session) return;
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId: session.id },
    orderBy: { id: 'asc' },
  });
  res.json({ ...session, messages });
}));

// POST /api/chat/sessions/:id/messages { content } — one admin turn through the tool loop.
router.post('/sessions/:id/messages', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req, res);
  if (!session) return;

  const content = req.body?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'content is required' });
  }

  // Name the chat from its first real user message so the sidebar isn't a wall of "New chat".
  if (session.title === DEFAULT_TITLE) {
    const priorUser = await prisma.chatMessage.count({ where: { sessionId: session.id, role: 'user' } });
    if (priorUser === 0) {
      await prisma.chatSession.update({ where: { id: session.id }, data: { title: content.slice(0, 80) } });
    }
  }

  try {
    const result = await runChatStep(session.id, content, ctxFor(req, session.id));
    res.json(result);
  } catch (e: any) {
    if (NOT_FOUND_MESSAGES.has(e?.message)) return res.status(404).json({ error: e.message });
    throw e;
  }
}));

// POST /api/chat/sessions/:id/confirm { actionId, approve } — resolve a parked action.
router.post('/sessions/:id/confirm', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const session = await loadOwnedSession(req, res);
  if (!session) return;

  const { actionId, approve } = req.body ?? {};
  if (typeof actionId !== 'string' || typeof approve !== 'boolean') {
    return res.status(400).json({ error: 'actionId (string) and approve (boolean) are required' });
  }

  try {
    const result = await resolvePendingAction(session.id, actionId, approve, ctxFor(req, session.id));
    res.json(result);
  } catch (e: any) {
    if (NOT_FOUND_MESSAGES.has(e?.message)) return res.status(404).json({ error: e.message });
    throw e;
  }
}));

export default router;
