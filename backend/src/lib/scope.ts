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

// Workspace-scoped core of assignee resolution (C1), req/res-free so non-HTTP callers
// (the chat action executor, M3b Task 6) can reuse it. `studentIds` omitted → every
// student in the workspace (the picker's select-all default); provided → exactly those,
// but each must be a student in the workspace, else it throws.
export async function resolveAssigneeStudentIdsForWorkspace(
  workspaceId: number,
  studentIds: unknown
): Promise<number[]> {
  const workspaceStudents = await prisma.user.findMany({
    where: { workspaceId, role: 'student' },
    select: { id: true },
  });
  const allIds = workspaceStudents.map((s) => s.id);

  if (studentIds === undefined || studentIds === null) return allIds;

  if (!Array.isArray(studentIds) || !studentIds.every((v) => Number.isInteger(v))) {
    throw new Error('studentIds must be an array of student ids');
  }
  const allowed = new Set(allIds);
  if ((studentIds as number[]).some((id) => !allowed.has(id))) {
    throw new Error('studentIds must all be students in your workspace');
  }
  return studentIds as number[];
}

// HTTP wrapper for the save route: translates the core's errors into a 400 response and
// returns null, preserving the route's existing contract.
export async function resolveAssigneeStudentIds(
  req: Request,
  res: Response,
  studentIds: unknown
): Promise<number[] | null> {
  try {
    return await resolveAssigneeStudentIdsForWorkspace(req.user!.workspaceId, studentIds);
  } catch (e: any) {
    res.status(400).json({ error: e.message, status: 400 });
    return null;
  }
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
