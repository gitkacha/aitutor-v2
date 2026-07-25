// M3b Task 9: read-only intervention API. There is no public POST — interventions are created
// only inside the coach chat via the confirm flow (chat.ts). Both routes are admin-only and
// workspace-scoped: a student out of the caller's workspace, or an intervention belonging to
// another workspace, is reported as 404 (never leaks existence).
import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin } from '../middleware/auth';
import { canAccessUser } from '../lib/scope';
import { listInterventions, getInterventionOutcome, listActiveInterventions } from '../services/intervention.service';

const router = Router();

// GET /api/interventions/active — the workspace-wide active-interventions strip (any student).
// Declared before the ':id' style routes so 'active' isn't parsed as an id.
router.get('/active', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  res.json(await listActiveInterventions(req.user!.workspaceId));
}));

// GET /api/interventions?studentId= — a student's intervention history (with live outcomes).
router.get('/', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const raw = req.query.studentId as string | undefined;
  const studentId = parseInt(raw ?? '');
  if (isNaN(studentId)) {
    return res.status(400).json({ error: 'studentId is required' });
  }
  // Out-of-workspace students look like missing rows.
  if (!(await canAccessUser(req, studentId))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  res.json(await listInterventions(studentId));
}));

// GET /api/interventions/:id/outcome — the recomputed (never stored) outcome for one intervention.
router.get('/:id/outcome', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(404).json({ error: 'Intervention not found' });
  }
  const intervention = await prisma.intervention.findUnique({ where: { id } });
  if (!intervention || intervention.workspaceId !== req.user!.workspaceId) {
    return res.status(404).json({ error: 'Intervention not found' });
  }
  res.json(await getInterventionOutcome(id));
}));

export default router;
