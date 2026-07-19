import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { toSessionUser } from '../middleware/auth';

const router = Router();

// First-run setup: a fresh install has zero users and gets a setup screen that creates
// the first workspace and its first admin. Closed permanently once any user exists.

router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const users = await prisma.user.count();
  res.json({ needsSetup: users === 0 });
}));

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { workspaceName, name, email, password } = req.body;
  if (!workspaceName || !name || typeof email !== 'string' || typeof password !== 'string' || password.length < 8) {
    res.status(400).json({
      error: 'workspaceName, name, email and a password of at least 8 characters are required',
      status: 400,
    });
    return;
  }

  const users = await prisma.user.count();
  if (users > 0) {
    res.status(409).json({ error: 'Setup has already been completed', status: 409 });
    return;
  }

  const slug = String(workspaceName).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  const workspace = await prisma.workspace.create({ data: { name: workspaceName, slug } });
  const admin = await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      role: 'admin',
      // The very first admin of a fresh system is the platform super-admin, so more
      // workspaces can be provisioned later (W-15).
      isSuperAdmin: true,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  if (req.session) req.session.userId = admin.id;
  res.status(201).json({ workspace: { id: workspace.id, name: workspace.name }, user: toSessionUser(admin) });
}));

export default router;
