import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';

// The session-facing user shape. Never includes passwordHash or provider internals.
export interface SessionUser {
  id: number;
  workspaceId: number;
  role: string;
  name: string;
  email: string;
  isSuperAdmin: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function toSessionUser(u: {
  id: number; workspaceId: number; role: string; name: string; email: string; isSuperAdmin: boolean;
}): SessionUser {
  return { id: u.id, workspaceId: u.workspaceId, role: u.role, name: u.name, email: u.email, isSuperAdmin: u.isSuperAdmin };
}

// Loads req.user from the session cookie when present; never rejects on its own.
export const attachUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  if (typeof userId === 'number') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) req.user = toSessionUser(user);
  }
  next();
});

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in', status: 401 });
    return;
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in', status: 401 });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required', status: 403 });
    return;
  }
  next();
}

// Platform capability (W-15): create workspaces + their first admin, and read-only
// oversight of any workspace. Orthogonal to workspace role.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    res.status(401).json({ error: 'Not signed in', status: 401 });
    return;
  }
  if (!req.user.isSuperAdmin) {
    res.status(403).json({ error: 'Super-admin access required', status: 403 });
    return;
  }
  next();
}
