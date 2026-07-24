// M3b Task 8: the intervention service. Creation freezes a diagnosis snapshot at that instant
// (spec §6.1/§6.2); outcome recomputation (§6.3) is always live and never stored. All statistics
// live in analytics-core via analytics.service's adapters — this file only orchestrates and
// applies the outcomeStatus decision rule.
import type { Intervention } from '@prisma/client';
import prisma from '../lib/prisma';
import { getStudentSkillReport, getSkillSignalsSince } from './analytics.service';
import type { SkillSignal } from './analytics-core';

export type OutcomeStatus = 'insufficient-evidence' | 'improving' | 'not-yet-improving';

// spec §6.3, exact: post-attempted < 8 → insufficient-evidence; else post-accuracy ≥ snapshot
// accuracy + 10 percentage points (0.10, accuracy is a 0..1 fraction) → improving; else
// not-yet-improving.
export function outcomeStatus(
  snapshotAccuracy: number,
  postAttempted: number,
  postAccuracy: number
): OutcomeStatus {
  if (postAttempted < 8) return 'insufficient-evidence';
  if (postAccuracy >= snapshotAccuracy + 0.1) return 'improving';
  return 'not-yet-improving';
}

// The exact frozen shape (spec §6.2): one SkillSignal (§4.10) per targeted skill.
export interface DiagnosisSnapshot {
  capturedAt: string;
  windowTests: number;
  skills: SkillSignal[];
}

export type WorksheetIds = { math?: number[]; writing?: number[] } | number[];

export interface CreateInterventionInput {
  workspaceId: number;
  studentId: number;
  createdById: number;
  chatSessionId?: number;
  skillSlugs: string[];
  recommendation: string;
  rationale: string;
  worksheetIds?: WorksheetIds;
  coachingModuleIds?: number[];
}

// Recomputes the student's math skill report NOW and freezes the targeted skills' signals —
// diagnosisSnapshot is server-computed here, never model-supplied, and is never updated again.
export async function createIntervention(input: CreateInterventionInput): Promise<Intervention> {
  const report = await getStudentSkillReport(input.studentId, 'math');
  const targeted = (report.skills as SkillSignal[]).filter((s) => input.skillSlugs.includes(s.slug));

  const diagnosisSnapshot: DiagnosisSnapshot = {
    capturedAt: new Date().toISOString(),
    windowTests: report.window.tests,
    skills: targeted,
  };

  return prisma.intervention.create({
    data: {
      workspaceId: input.workspaceId,
      studentId: input.studentId,
      createdById: input.createdById,
      chatSessionId: input.chatSessionId,
      skillSlugs: JSON.stringify(input.skillSlugs),
      diagnosisSnapshot: JSON.stringify(diagnosisSnapshot),
      recommendation: input.recommendation,
      rationale: input.rationale,
      worksheetIds: JSON.stringify(input.worksheetIds ?? {}),
      coachingModuleIds: JSON.stringify(input.coachingModuleIds ?? []),
    },
  });
}

export interface PerSkillOutcome {
  slug: string;
  before: number;
  postAttempted: number;
  postAccuracy: number;
  status: OutcomeStatus;
}

export interface InterventionOutcome {
  perSkill: PerSkillOutcome[];
  status: OutcomeStatus;
}

// Always recomputed live, never stored (§6.3). For each targeted skill: before = the frozen
// snapshot signal's accuracy; postAttempted/postAccuracy = the same skill recomputed over
// attempts finished strictly after the intervention was created.
export async function getInterventionOutcome(interventionId: number): Promise<InterventionOutcome> {
  const intervention = await prisma.intervention.findUniqueOrThrow({ where: { id: interventionId } });

  const snapshot = JSON.parse(intervention.diagnosisSnapshot) as DiagnosisSnapshot;
  const targetedSlugs: string[] = JSON.parse(intervention.skillSlugs);
  const snapshotBySlug = new Map(snapshot.skills.map((s) => [s.slug, s]));

  const postSignals = await getSkillSignalsSince(intervention.studentId, intervention.createdAt.toISOString());
  const postBySlug = new Map(postSignals.map((s) => [s.slug, s]));

  const perSkill: PerSkillOutcome[] = targetedSlugs.map((slug) => {
    const before = snapshotBySlug.get(slug)?.accuracy ?? 0;
    const post = postBySlug.get(slug);
    const postAttempted = post?.attempted ?? 0;
    const postAccuracy = post?.accuracy ?? 0;
    return { slug, before, postAttempted, postAccuracy, status: outcomeStatus(before, postAttempted, postAccuracy) };
  });

  // Intervention-level status = worst of its skills' statuses: any not-yet-improving → that;
  // else any insufficient-evidence → that; else improving. Empty → insufficient-evidence.
  const status: OutcomeStatus = perSkill.some((p) => p.status === 'not-yet-improving')
    ? 'not-yet-improving'
    : perSkill.some((p) => p.status === 'insufficient-evidence') || perSkill.length === 0
      ? 'insufficient-evidence'
      : 'improving';

  return { perSkill, status };
}

export async function listInterventions(
  studentId: number
): Promise<Array<Intervention & { outcome: InterventionOutcome }>> {
  const interventions = await prisma.intervention.findMany({
    where: { studentId },
    orderBy: { createdAt: 'desc' },
  });

  return Promise.all(
    interventions.map(async (intervention) => ({
      ...intervention,
      outcome: await getInterventionOutcome(intervention.id),
    }))
  );
}
