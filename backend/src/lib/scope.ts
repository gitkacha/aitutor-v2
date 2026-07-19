import { Request, Response } from 'express';
import prisma from './prisma';

// Tenant scoping (Milestone 2 Phase B1). Resolves which users' rows the caller may
// read: a student always and only themselves; an admin their whole workspace, or a
// single member via ?studentId=. Writes the 400/403 response and returns null when
// the request is not allowed.
export async function resolveScopeUserIds(req: Request, res: Response): Promise<number[] | null> {
  const user = req.user!;
  const raw = req.query.studentId as string | undefined;

  if (raw !== undefined) {
    const id = parseInt(raw);
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid studentId', status: 400 });
      return null;
    }
    if (user.role !== 'admin') {
      if (id !== user.id) {
        res.status(403).json({ error: 'Students can only view their own data', status: 403 });
        return null;
      }
      return [user.id];
    }
    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.workspaceId !== user.workspaceId) {
      res.status(403).json({ error: 'That student is not in your workspace', status: 403 });
      return null;
    }
    return [id];
  }

  if (user.role !== 'admin') return [user.id];

  // Admin with no target: aggregate across the whole workspace (per-student views
  // pass ?studentId= — the C1 UI's job).
  const members = await prisma.user.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true },
  });
  return members.map((m) => m.id);
}

// Resolves the student ids a worksheet is assigned to at save time (C1). `studentIds`
// omitted → every student in the admin's workspace (the picker's select-all default);
// provided → exactly those, but each must be a student in the admin's workspace, else a
// 400 is written and null returned.
export async function resolveAssigneeStudentIds(
  req: Request,
  res: Response,
  studentIds: unknown
): Promise<number[] | null> {
  const workspaceStudents = await prisma.user.findMany({
    where: { workspaceId: req.user!.workspaceId, role: 'student' },
    select: { id: true },
  });
  const allIds = workspaceStudents.map((s) => s.id);

  if (studentIds === undefined || studentIds === null) return allIds;

  if (!Array.isArray(studentIds) || !studentIds.every((v) => Number.isInteger(v))) {
    res.status(400).json({ error: 'studentIds must be an array of student ids', status: 400 });
    return null;
  }
  const allowed = new Set(allIds);
  if ((studentIds as number[]).some((id) => !allowed.has(id))) {
    res.status(400).json({ error: 'studentIds must all be students in your workspace', status: 400 });
    return null;
  }
  return studentIds as number[];
}

// True when the caller may see rows belonging to `ownerId`: their own rows, or —
// for admins — rows of any member of their workspace.
export async function canAccessUser(req: Request, ownerId: number): Promise<boolean> {
  const user = req.user!;
  if (ownerId === user.id) return true;
  if (user.role !== 'admin') return false;
  const owner = await prisma.user.findUnique({ where: { id: ownerId } });
  return !!owner && owner.workspaceId === user.workspaceId;
}
