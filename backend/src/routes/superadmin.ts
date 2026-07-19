import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireSuperAdmin, toSessionUser } from '../middleware/auth';
import { aggregateWritingHeatmap } from '../lib/writing-heatmap-aggregate';
import { aggregateMathHeatmap } from '../lib/math-heatmap-aggregate';

const router = Router();

// Platform provisioning + read-only oversight (W-15). Every route is super-admin only;
// the normal per-workspace routes and scope.ts are untouched, so tenant isolation for
// ordinary admins is unchanged.

async function uniqueSlug(base: string): Promise<string> {
  const root = base.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace';
  let slug = root;
  let n = 2;
  // slug is unique; on collision append a counter.
  while (await prisma.workspace.findUnique({ where: { slug } })) {
    slug = `${root}-${n++}`;
  }
  return slug;
}

// GET /api/superadmin/workspaces — every workspace with member counts.
router.get('/workspaces', requireSuperAdmin, asyncHandler(async (_req: Request, res: Response) => {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { id: 'asc' },
    include: { users: { select: { role: true } } },
  });
  res.json({
    workspaces: workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      isDemo: w.isDemo,
      adminCount: w.users.filter((u) => u.role === 'admin').length,
      studentCount: w.users.filter((u) => u.role === 'student').length,
    })),
  });
}));

// POST /api/superadmin/workspaces — create a workspace and its first admin.
router.post('/workspaces', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const { workspaceName, adminName, adminEmail, adminPassword } = req.body;
  if (!workspaceName || !adminName || typeof adminEmail !== 'string' ||
      typeof adminPassword !== 'string' || adminPassword.length < 8) {
    res.status(400).json({
      error: 'workspaceName, adminName, adminEmail and an adminPassword of at least 8 characters are required',
      status: 400,
    });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists', status: 409 });
    return;
  }

  const workspace = await prisma.workspace.create({
    data: { name: workspaceName, slug: await uniqueSlug(workspaceName) },
  });
  const admin = await prisma.user.create({
    data: {
      workspaceId: workspace.id,
      role: 'admin',
      isSuperAdmin: false, // a delegated workspace admin, not another platform super-admin
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 10),
    },
  });

  res.status(201).json({
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug },
    admin: toSessionUser(admin),
  });
}));

// GET /api/superadmin/workspaces/:id — read-only oversight: members + performance.
router.get('/workspaces/:id', requireSuperAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid workspace id', status: 400 });
    return;
  }
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) {
    res.status(404).json({ error: 'Workspace not found', status: 404 });
    return;
  }

  const members = await prisma.user.findMany({
    where: { workspaceId: id },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  const studentIds = members.filter((m) => m.role === 'student').map((m) => m.id);

  const types = await prisma.writingType.findMany({
    include: { attempts: { where: { userId: { in: studentIds } }, include: { analysis: true } } },
    orderBy: { name: 'asc' },
  });
  const topics = await prisma.mathTopic.findMany({ orderBy: { name: 'asc' } });
  const mathAttempts = await prisma.mathAttempt.findMany({ where: { userId: { in: studentIds } } });

  res.json({
    workspace: { id: workspace.id, name: workspace.name, slug: workspace.slug, isDemo: workspace.isDemo },
    members: members.map(toSessionUser),
    writingHeatmap: aggregateWritingHeatmap(types),
    mathHeatmap: aggregateMathHeatmap(topics, mathAttempts),
  });
}));

export default router;
