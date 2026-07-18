import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, toSessionUser } from '../middleware/auth';

const router = Router();

// Workspace membership — always scoped to the caller's own workspace.

router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    where: { workspaceId: req.user!.workspaceId },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json({ users: users.map(toSessionUser) });
}));

router.post('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role } = req.body;
  if (!name || typeof email !== 'string' || typeof password !== 'string' || password.length < 8 ||
      !['admin', 'student'].includes(role)) {
    res.status(400).json({
      error: 'name, email, a password of at least 8 characters, and role (admin|student) are required',
      status: 400,
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists', status: 409 });
    return;
  }

  const user = await prisma.user.create({
    data: {
      workspaceId: req.user!.workspaceId,
      role,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  res.status(201).json({ user: toSessionUser(user) });
}));

export default router;
