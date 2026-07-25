import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/async-handler';
import { requireAdmin, requireAuth } from '../middleware/auth';
import { canAccessUser } from '../lib/scope';
import { getStudentSkillReport, getOpportunityAreas, getSkillTrend, getMathImprovements } from '../services/analytics.service';

const router = Router();

function parseSubject(raw: unknown): 'math' | 'writing' | null {
  return raw === 'math' || raw === 'writing' ? raw : null;
}

// GET /api/analytics/students/:id/report?subject=math|writing&lastNTests= — admin-only skill
// report for one student (answer-key-adjacent data: chosenOptionText, per-skill counts).
router.get('/students/:id/report', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid student id' });
  }

  // Out-of-scope reads look like missing rows (same B1 pattern as the other routes).
  if (!(await canAccessUser(req, id))) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const subject = parseSubject(req.query.subject);
  if (!subject) {
    return res.status(400).json({ error: 'subject must be "math" or "writing"' });
  }

  let lastNTests: number | undefined;
  if (req.query.lastNTests !== undefined) {
    const n = parseInt(req.query.lastNTests as string);
    if (isNaN(n) || n <= 0) {
      return res.status(400).json({ error: 'lastNTests must be a positive integer' });
    }
    lastNTests = n;
  }

  const report = await getStudentSkillReport(id, subject, lastNTests);
  res.json(report);
}));

// GET /api/analytics/students/:id/skills/:slug/trend?subject=math — admin-only per-skill accuracy
// series for the trend chart (one point per attempt containing the skill).
router.get('/students/:id/skills/:slug/trend', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) {
    return res.status(400).json({ error: 'Invalid student id' });
  }
  if (!(await canAccessUser(req, id))) {
    return res.status(404).json({ error: 'Student not found' });
  }
  const subject = parseSubject(req.query.subject);
  if (subject !== 'math') {
    return res.status(400).json({ error: 'subject must be "math"' });
  }
  const series = await getSkillTrend(id, req.params.slug);
  res.json(series);
}));

// GET /api/analytics/opportunity-areas?subject=&studentId= — with studentId, that student's
// ranked weak skills; without, the workspace-wide cohort ranking.
router.get('/opportunity-areas', requireAdmin, asyncHandler(async (req: Request, res: Response) => {
  const subject = parseSubject(req.query.subject);
  if (!subject) {
    return res.status(400).json({ error: 'subject must be "math" or "writing"' });
  }

  let studentId: number | undefined;
  if (req.query.studentId !== undefined) {
    const id = parseInt(req.query.studentId as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    if (!(await canAccessUser(req, id))) {
      return res.status(404).json({ error: 'Student not found' });
    }
    studentId = id;
  }

  const areas = await getOpportunityAreas(req.user!.workspaceId, subject, studentId);
  res.json(areas);
}));

// GET /api/analytics/me/improvements?subject=math&studentId? — a student's "most improved"
// topics. requireAuth (not requireAdmin): a student may see their own; with ?studentId=, an
// admin may view a member of their workspace (out-of-scope → 404, same B1 pattern as the other
// routes). math-only for now — computeSkillImprovements has no writing equivalent yet.
router.get('/me/improvements', requireAuth, asyncHandler(async (req: Request, res: Response) => {
  const subject = req.query.subject;
  if (subject !== 'math') {
    return res.status(400).json({ error: 'subject must be "math"' });
  }

  let targetId = req.user!.id;
  if (req.query.studentId !== undefined) {
    const id = parseInt(req.query.studentId as string);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }
    if (!(await canAccessUser(req, id))) {
      return res.status(404).json({ error: 'Student not found' });
    }
    targetId = id;
  }

  res.json(await getMathImprovements(targetId));
}));

export default router;
