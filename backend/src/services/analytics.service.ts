import prisma from '../lib/prisma';
import {
  AnswerRecord,
  SkillSignal,
  WritingAnalysisRecord,
  ImprovedSkill,
  EVIDENCE_FLOOR,
  median,
  computeSkillSignals,
  computePacingCurve,
  computeCohortAccuracy,
  rankOpportunityAreas,
  rankWritingOpportunityAreas,
  computeWritingSignals,
  computeWritingUsage,
  computeSkillTrendSeries,
  computeSkillImprovements,
  SkillTrendPoint,
} from './analytics-core';

// Writing timed practice uses a fixed 30-minute limit (frontend TimedPractice.tsx's
// TOTAL_TIME = 1800). There's no per-prompt/type time-limit config to read, so every writing
// Attempt gets this same limit for the time-used-ratio computation (spec §4.9).
const WRITING_TIME_LIMIT_SEC = 1800;

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
  writingUsage?: ReturnType<typeof computeWritingUsage>;
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

interface RawMathAttemptRow {
  id: number;
  finishedAt: Date;
  questions: string;
  answers: string;
  questionTimings: string | null;
  questionFlags: string | null;
  answerChanges: string | null;
}

// Builds AnswerRecords from an arbitrary set of already-fetched MathAttempt rows, per the
// Task 6 adapter rules. Questions without a skillId are counted into untaggedQuestions rather
// than turned into a record — the core never sees skill-less questions. Shared by
// buildMathWindow (last-N window) and getSkillSignalsSince (date-range window, M3b Task 8).
async function buildMathRecords(attempts: RawMathAttemptRow[]) {
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

  return { records, untaggedQuestions };
}

// Builds AnswerRecords for a student's last `lastNTests` MathAttempts (any source).
async function buildMathWindow(studentId: number, lastNTests: number) {
  const attempts = await prisma.mathAttempt.findMany({
    where: { userId: studentId },
    orderBy: { finishedAt: 'desc' },
    take: lastNTests,
  });

  const { records, untaggedQuestions } = await buildMathRecords(attempts);
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

// M3b Task 8 (intervention outcome recomputation, spec §6.3): signals over ALL of a student's
// math attempts with finishedAt strictly after `sinceISO`, rather than a last-N window. Reuses
// the same AnswerRecord adapter (buildMathRecords) and the same own-median-time M (computed over
// all of the student's timed questions, per §4's "own median time" definition — unwindowed) as
// getStudentSkillReport, so this stays a thin adapter with no statistics of its own.
export async function getSkillSignalsSince(studentId: number, sinceISO: string): Promise<SkillSignal[]> {
  const attempts = await prisma.mathAttempt.findMany({
    where: { userId: studentId, finishedAt: { gt: new Date(sinceISO) } },
    orderBy: { finishedAt: 'desc' },
  });
  const { records } = await buildMathRecords(attempts);
  const medianMs = await computeStudentMedianMs(studentId);
  return computeSkillSignals(records, medianMs);
}

// M3b-2: the per-skill accuracy series for the chart. Reuses buildMathRecords (same adapter as
// the report) over all of the student's math attempts, then computeSkillTrendSeries in the core —
// no statistics here.
export async function getSkillTrend(studentId: number, slug: string): Promise<SkillTrendPoint[]> {
  const attempts = await prisma.mathAttempt.findMany({
    where: { userId: studentId },
    orderBy: { finishedAt: 'asc' },
  });
  const { records } = await buildMathRecords(attempts);
  return computeSkillTrendSeries(records, slug);
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

  const records: WritingAnalysisRecord[] = analysisRows.map((a) => {
    const trimmed = a.attempt.text.trim();
    return {
      finishedAt: a.attempt.finishedAt.toISOString(),
      criteriaScores: safeParse<Record<string, number>>(a.criteriaScores),
      timeTakenSec: a.attempt.timeTaken,
      timeLimitSec: WRITING_TIME_LIMIT_SEC,
      wordCount: trimmed ? trimmed.split(/\s+/).length : 0,
    };
  });

  const writingSkills = computeWritingSignals(records);
  const writingUsage = computeWritingUsage(records);
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

  return {
    window: { tests: analysisRows.length, from, to, medianTimeMs: null, untaggedQuestions: 0 },
    skills,
    writingUsage,
  };
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

// M3c-1 Task 2 (W-59): student-facing "most improved" adapter. A topic surfaces when at least
// one of its skills clears computeSkillImprovements' evidence floor + gain threshold; each
// topic shows up to its top-3 improved skills (already gainScore-descending, since
// computeSkillImprovements sorts the whole list that way and grouping preserves order) and the
// best (first) skill's gain as the topic-level delta. No statistics computed here — grouping,
// topic resolution and ranking only.
export interface ImprovedTopic {
  slug: string;
  name: string;
  delta: { metric: 'accuracy' | 'speed'; value: number };
  interventionId: number | null;
  skills: ImprovedSkill[];
}

export async function getMathImprovements(studentId: number): Promise<{ topics: ImprovedTopic[] }> {
  const { records } = await buildMathWindow(studentId, DEFAULT_WINDOW);
  const improvements = computeSkillImprovements(records);
  if (improvements.length === 0) return { topics: [] };

  const skillRows = await prisma.skill.findMany({
    where: { slug: { in: improvements.map((s) => s.slug) } },
    select: { slug: true, topic: { select: { slug: true, name: true } } },
  });
  const topicBySkillSlug = new Map<string, { slug: string; name: string }>();
  for (const row of skillRows) {
    if (row.topic) topicBySkillSlug.set(row.slug, { slug: row.topic.slug, name: row.topic.name });
  }

  // Group by topic, skipping any improved skill whose topic can't resolve. `improvements` is
  // already sorted desc by gainScore, so pushing in iteration order keeps each group's skills
  // in that same order.
  const byTopic = new Map<string, { name: string; skills: ImprovedSkill[] }>();
  for (const imp of improvements) {
    const topic = topicBySkillSlug.get(imp.slug);
    if (!topic) continue;
    if (!byTopic.has(topic.slug)) byTopic.set(topic.slug, { name: topic.name, skills: [] });
    byTopic.get(topic.slug)!.skills.push(imp);
  }
  if (byTopic.size === 0) return { topics: [] };

  // Most recent active intervention per targeted skill, for the "shown skill has an active
  // intervention" badge — matched against each topic's shown (top-3) skills only.
  const interventions = await prisma.intervention.findMany({
    where: { studentId, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  const findInterventionId = (shownSlugs: string[]): number | null => {
    for (const iv of interventions) {
      let targeted: string[];
      try {
        targeted = JSON.parse(iv.skillSlugs);
      } catch {
        continue;
      }
      if (shownSlugs.some((slug) => targeted.includes(slug))) return iv.id;
    }
    return null;
  };

  // Rank topics by their TRUE improved-skill count (captured before slicing to the top-3 shown),
  // then by best gainScore — so a topic with 9 improved skills outranks one with 4 even though
  // both display only 3.
  const ranked = [...byTopic.entries()]
    .map(([topicSlug, { name, skills }]) => ({ topicSlug, name, skills, improvedCount: skills.length }))
    .sort((a, b) => b.improvedCount - a.improvedCount || b.skills[0].gainScore - a.skills[0].gainScore)
    .slice(0, 5);

  const topics: ImprovedTopic[] = ranked.map(({ topicSlug, name, skills }) => {
    const shown = skills.slice(0, 3);
    const best = shown[0];
    const value = Math.round(best.metric === 'accuracy' ? best.accGainPts! : best.quickerPct!);
    return {
      slug: topicSlug,
      name,
      delta: { metric: best.metric, value },
      interventionId: findInterventionId(shown.map((s) => s.slug)),
      skills: shown,
    };
  });

  return { topics };
}
