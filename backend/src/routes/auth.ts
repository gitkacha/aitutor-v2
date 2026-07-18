import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { getIdentityProvider } from '../services/auth/identity-provider';
import { toSessionUser } from '../middleware/auth';

const router = Router();

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required', status: 400 });
    return;
  }

  const identity = await getIdentityProvider().verifyCredentials(email, password);
  if (!identity) {
    res.status(401).json({ error: 'Invalid email or password', status: 401 });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: identity.userId } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password', status: 401 });
    return;
  }

  if (req.session) req.session.userId = user.id;
  res.json({ user: toSessionUser(user) });
}));

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  req.session = null;
  res.json({ ok: true });
}));

router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in', status: 401 });
    return;
  }
  res.json({ user: req.user });
}));

export default router;
