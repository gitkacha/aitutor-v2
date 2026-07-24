import prisma from '../lib/prisma';
import {
  AnswerRecord,
  SkillSignal,
  WritingAnalysisRecord,
  EVIDENCE_FLOOR,
  median,
  computeSkillSignals,
  computePacingCurve,
  computeCohortAccuracy,
  rankOpportunityAreas,
  rankWritingOpportunityAreas,
  computeWritingSignals,
} from './analytics-core';

// M3a Task 6: the DB adapter. This file maps Prisma rows onto the pure core's input types
// (AnswerRecord / WritingAnalysisRecord) and calls the core to do the actual statistics — no
// statistics logic lives here. If a computation isn't in analytics-core.ts, it doesn't happen.

const DEFAULT_WINDOW = 10;

export interface ReportWindow {
  tests: number;
  from: string | null;
  to: string | null;
  medianTimeMs: number | null;
  untaggedQuestions: number;
}

// Writing has no per-question correctness/timing to build a SkillSignal from —
// computeWritingSignals (analytics-core) produces its own shape. This extends it with a
// display name (Skill table lookup, not a computation) and the same evidence-floor gate math
// uses, so the writing report is evidence-gated too.
export interface WritingSkillSignal {
  slug: string;
  name: string;
  mean: number;
  trendPts: number | null;
  n: number;
  sufficientEvidence: boolean;
}

export interface StudentSkillReport {
  window: ReportWindow;
  skills: SkillSignal[] | WritingSkillSignal[];
  pacing?: ReturnType<typeof computePacingCurve>;
}

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface ParsedMathAttempt {
  id: number;
  finishedAt: Date;
  questionIds: number[];
  answers: number[];
  timings: Record<string, number> | null;
  flags: number[] | null;
  changes: Record<string, number> | null;
}

function parseMathAttempt(a: {
  id: number;
  finishedAt: Date;
  questions: string;
  answers: string;
  questionTimings: string | null;
  questionFlags: string | null;
  answerChanges: string | null;
}): ParsedMathAttempt {
  return {
    id: a.id,
    finishedAt: a.finishedAt,
    questionIds: safeParse<number[]>(a.questions) ?? [],
    answers: safeParse<number[]>(a.answers) ?? [],
    timings: safeParse<Record<string, number>>(a.questionTimings),
    flags: safeParse<number[]>(a.questionFlags),
    changes: safeParse<Record<string, number>>(a.answerChanges),
  };
}

// Builds AnswerRecords for a student's last `lastNTests` MathAttempts (any source), per the
// Task 6 adapter rules. Questions without a skillId are counted into untaggedQuestions rather
// than turned into a record — the core never sees skill-less questions.
async function buildMathWindow(studentId: number, lastNTests: number) {
  const attempts = await prisma.mathAttempt.findMany({
    where: { userId: studentId },
    orderBy: { finishedAt: 'desc' },
    take: lastNTests,
  });

  const parsed = attempts.map(parseMathAttempt);
  const allQuestionIds = [...new Set(parsed.flatMap((p) => p.questionIds))];
  const questions = allQuestionIds.length
    ? await prisma.mathQuestion.findMany({ where: { id: { in: allQuestionIds } }, include: { skill: true } })
    : [];
  const questionMap = new Map(questions.map((q) => [q.id, q]));

  const records: AnswerRecord[] = [];
  let untaggedQuestions = 0;

  for (const p of parsed) {
    const attemptSize = p.questionIds.length;
    for (let i = 0; i < p.questionIds.length; i++) {
      const qid = p.questionIds[i];
      const question = questionMap.get(qid);
      if (!question || question.skillId == null || !question.skill) {
        untaggedQuestions++;
        continue;
      }
      const rawAnswer: number | undefined = p.answers[i];
      const chosenIndex = rawAnswer == null || rawAnswer === -1 ? null : rawAnswer;
      const options = safeParse<string[]>(question.options) ?? [];
      records.push({
        attemptId: p.id,
        finishedAt: p.finishedAt.toISOString(),
        skillSlug: question.skill.slug,
        skillName: question.skill.name,
        correct: rawAnswer === question.correctIndex,
        chosenIndex,
        chosenOptionText: chosenIndex != null ? options[chosenIndex] ?? null : null,
        timeMs: p.timings?.[qid] ?? null,
        flagged: p.flags != null && p.flags.includes(qid),
        answerChanges: p.changes?.[qid] ?? 0,
        positionIndex: i,
        attemptSize,
      });
    }
  }

  return { attempts, records, untaggedQuestions };
}

// Median dwell over ALL of the student's attempts (not just the window) — the adapter's own
// median M used by the core's time-based signals.
async function computeStudentMedianMs(studentId: number): Promise<number | null> {
  const rows = await prisma.mathAttempt.findMany({
    where: { userId: studentId },
    select: { questionTimings: true },
  });
  const values: number[] = [];
  for (const row of rows) {
    const timings = safeParse<Record<string, number>>(row.questionTimings);
    if (!timings) continue;
    for (const v of Object.values(timings)) {
      if (typeof v === 'number' && Number.isFinite(v)) values.push(v);
    }
  }
  return median(values);
}

async function computeMathSignalsForStudent(studentId: number, lastNTests: number): Promise<SkillSignal[]> {
  const { records } = await buildMathWindow(studentId, lastNTests);
  const medianMs = await computeStudentMedianMs(studentId);
  return computeSkillSignals(records, medianMs);
}

async function getMathReport(studentId: number, lastNTests: number): Promise<StudentSkillReport> {
  const { attempts, records, untaggedQuestions } = await buildMathWindow(studentId, lastNTests);
  const medianTimeMs = await computeStudentMedianMs(studentId);
  const skills = computeSkillSignals(records, medianTimeMs);
  const pacing = computePacingCurve(records);

  // Cohort baseline (math only, §4.6 of the M3 design doc): every student in the target's
  // workspace, each computed over their own window. The >= 5 qualifying-students gate lives
  // entirely inside computeCohortAccuracy.
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (student) {
    const workspaceStudents = await prisma.user.findMany({
      where: { workspaceId: student.workspaceId, role: 'student' },
      select: { id: true },
    });
    const perStudent = new Map<number, SkillSignal[]>();
    for (const s of workspaceStudents) {
      perStudent.set(s.id, s.id === studentId ? skills : await computeMathSignalsForStudent(s.id, lastNTests));
    }
    const cohort = computeCohortAccuracy(perStudent);
    for (const sig of skills) {
      const c = cohort.get(sig.slug);
      if (c !== undefined) sig.cohortAccuracy = c;
    }
  }

  const from = attempts.length ? attempts[attempts.length - 1].finishedAt.toISOString() : null;
  const to = attempts.length ? attempts[0].finishedAt.toISOString() : null;

  return { window: { tests: attempts.length, from, to, medianTimeMs, untaggedQuestions }, skills, pacing };
}

async function getWritingReport(studentId: number, lastNTests: number): Promise<StudentSkillReport> {
  // Start from Analysis so "last N Attempts that have an analysis" falls out of the join,
  // rather than filtering an optional to-one relation.
  const analysisRows = await prisma.analysis.findMany({
    where: { attempt: { userId: studentId } },
    orderBy: { attempt: { finishedAt: 'desc' } },
    take: lastNTests,
    include: { attempt: true },
  });

  const records: WritingAnalysisRecord[] = analysisRows.map((a) => ({
    finishedAt: a.attempt.finishedAt.toISOString(),
    criteriaScores: safeParse<Record<string, number>>(a.criteriaScores),
  }));

  const writingSkills = computeWritingSignals(records);
  const skillRows = writingSkills.length
    ? await prisma.skill.findMany({ where: { subject: 'writing', slug: { in: writingSkills.map((w) => w.slug) } } })
    : [];
  const nameBySlug = new Map(skillRows.map((s) => [s.slug, s.name]));

  const skills: WritingSkillSignal[] = writingSkills.map((w) => ({
    ...w,
    name: nameBySlug.get(w.slug) ?? w.slug,
    sufficientEvidence: w.n >= EVIDENCE_FLOOR,
  }));

  const from = analysisRows.length ? analysisRows[analysisRows.length - 1].attempt.finishedAt.toISOString() : null;
  const to = analysisRows.length ? analysisRows[0].attempt.finishedAt.toISOString() : null;

  return { window: { tests: analysisRows.length, from, to, medianTimeMs: null, untaggedQuestions: 0 }, skills };
}

export async function getStudentSkillReport(
  studentId: number,
  subject: 'math' | 'writing',
  lastNTests: number = DEFAULT_WINDOW
): Promise<StudentSkillReport> {
  return subject === 'math' ? getMathReport(studentId, lastNTests) : getWritingReport(studentId, lastNTests);
}

// Workspace-wide cohort ranking (no studentId): one row per skill with the cohort's mean
// accuracy and how many students had sufficient evidence on it. Math-only — see
// getOpportunityAreas's doc comment.
export interface CohortOpportunityArea {
  slug: string;
  name: string;
  cohortAccuracy: number;
  students: number;
}

export type OpportunityArea = SkillSignal | WritingSkillSignal | CohortOpportunityArea;

// Returns one of three shapes depending on the (subject, studentId) combination:
//  - subject: 'math', studentId set    → SkillSignal[]              (per-student math ranking)
//  - subject: 'writing', studentId set → WritingSkillSignal[]        (per-student writing ranking)
//  - studentId omitted (workspace-wide) → CohortOpportunityArea[]    (math only; [] for writing —
//    no cohort baseline exists for writing yet, see the adapter rules note below)
export async function getOpportunityAreas(
  workspaceId: number,
  subject: 'math' | 'writing',
  studentId?: number
): Promise<OpportunityArea[]> {
  if (studentId != null) {
    const report = await getStudentSkillReport(studentId, subject);
    if (subject === 'math') return rankOpportunityAreas(report.skills as SkillSignal[]);
    return rankWritingOpportunityAreas(report.skills as WritingSkillSignal[]);
  }

  // Workspace-wide: cohort computation is math-only per the adapter rules — writing has no
  // workspace-wide ranking until a cohort baseline exists for it.
  if (subject !== 'math') return [];

  const students = await prisma.user.findMany({ where: { workspaceId, role: 'student' }, select: { id: true } });
  const perStudent = new Map<number, SkillSignal[]>();
  for (const s of students) {
    perStudent.set(s.id, await computeMathSignalsForStudent(s.id, DEFAULT_WINDOW));
  }
  const cohort = computeCohortAccuracy(perStudent);

  const nameBySlug = new Map<string, string>();
  const studentsCountBySlug = new Map<string, number>();
  for (const signals of perStudent.values()) {
    for (const sig of signals) {
      if (!nameBySlug.has(sig.slug)) nameBySlug.set(sig.slug, sig.name);
      if (sig.sufficientEvidence) studentsCountBySlug.set(sig.slug, (studentsCountBySlug.get(sig.slug) ?? 0) + 1);
    }
  }

  return [...cohort.entries()]
    .map(([slug, cohortAccuracy]) => ({
      slug,
      name: nameBySlug.get(slug) ?? slug,
      cohortAccuracy,
      students: studentsCountBySlug.get(slug) ?? 0,
    }))
    .sort((a, b) => a.cohortAccuracy - b.cohortAccuracy);
}
