import { Prisma, PrismaClient } from '@prisma/client';
import prisma from '../lib/prisma';
import { validateStimulus, StimulusSpec } from '../lib/stimulus';
import { hasDistinctOptions, explanationMatchesKey } from '../lib/question-checks';

export interface WorksheetQuestionJson {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName?: string;
  skillSlug: string;
  stimulus?: StimulusSpec;
}

type Db = PrismaClient | Prisma.TransactionClient;

export function validateWorksheetQuestions(questions: unknown): questions is WorksheetQuestionJson[] {
  if (!Array.isArray(questions) || questions.length === 0) return false;
  return questions.every((q) =>
    q &&
    typeof q.questionText === 'string' &&
    Array.isArray(q.options) &&
    q.options.length >= 2 &&
    q.options.every((o: unknown) => typeof o === 'string') &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < q.options.length &&
    typeof q.topicSlug === 'string' &&
    // Skill tag (M3a Task 8): every saved question must name the skill it tests.
    typeof q.skillSlug === 'string' &&
    q.skillSlug.length > 0 &&
    (q.stimulus === undefined || validateStimulus(q.stimulus)) &&
    // Answer-correctness guards (W-20): no equal-value options, and the explanation must
    // not name a different option than the key.
    hasDistinctOptions(q.options.map(String)) &&
    (typeof q.explanation !== 'string' || explanationMatchesKey(q.explanation, q.correctIndex))
  );
}

// Persist worksheet questions as real MathQuestion rows so attempts are scored,
// stored and reviewed through the same ID-based path as regular practice.
export async function createWorksheetQuestionRows(
  worksheetId: number,
  questions: WorksheetQuestionJson[],
  db: Db = prisma
) {
  const slugs = [...new Set(questions.map((q) => q.topicSlug))];
  const topics = await db.mathTopic.findMany({ where: { slug: { in: slugs } } });
  const topicBySlug = new Map(topics.map((t) => [t.slug, t.id]));
  const missing = slugs.filter((s) => !topicBySlug.has(s));
  if (missing.length > 0) {
    throw new Error(`Unknown topic slug(s): ${missing.join(', ')}`);
  }

  // Resolve each skill tag to its Skill row (M3a Task 8) — an unknown slug is a 400,
  // same pattern as the unknown-topic error above.
  const skillIdBySlug = new Map<string, number>();
  for (const slug of [...new Set(questions.map((q) => q.skillSlug))]) {
    const skill = await db.skill.findUnique({ where: { slug } });
    if (!skill) {
      throw new Error(`Unknown skill slug: ${slug}`);
    }
    skillIdBySlug.set(slug, skill.id);
  }

  for (const q of questions) {
    // A structured stimulus (W-8) is persisted as its own MathStimulusGroup row so the
    // practice and review screens render it through the same path as seeded stimuli.
    let stimulusGroupId: number | undefined;
    if (q.stimulus) {
      const group = await db.mathStimulusGroup.create({
        data: { stimulus: JSON.stringify(q.stimulus) },
      });
      stimulusGroupId = group.id;
    }
    await db.mathQuestion.create({
      data: {
        topicId: topicBySlug.get(q.topicSlug)!,
        worksheetId,
        skillId: skillIdBySlug.get(q.skillSlug)!,
        questionText: q.questionText,
        options: JSON.stringify(q.options),
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        ...(stimulusGroupId !== undefined ? { stimulusGroupId } : {}),
      },
    });
  }
}

// Fetch a worksheet's question rows in authored order, materialising them from the
// stored JSON for worksheets saved before question rows existed.
export async function getWorksheetQuestionRows(worksheetId: number) {
  const worksheet = await prisma.mathWorksheet.findUnique({ where: { id: worksheetId } });
  if (!worksheet) return null;

  const fetchRows = () =>
    prisma.mathQuestion.findMany({
      where: { worksheetId },
      orderBy: { id: 'asc' },
      include: { stimulusGroup: true, topic: true, skill: true },
    });

  let rows = await fetchRows();
  if (rows.length === 0) {
    const json = JSON.parse(worksheet.questions || '[]');
    if (validateWorksheetQuestions(json)) {
      await createWorksheetQuestionRows(worksheetId, json);
      rows = await fetchRows();
    } else {
      // M3a Task 9: a legacy blob that fails validation (typically pre-taxonomy questions
      // with no skillSlug) used to be dropped silently, leaving the worksheet looking
      // empty. Still no behaviour change — but no longer silent. The backfill script
      // (scripts/backfill-skill-tags.ts) stamps skillSlug into such blobs.
      console.warn(
        `[worksheet] worksheet ${worksheetId}: legacy questions blob failed validation — returning no rows. ` +
        'Run scripts/backfill-skill-tags.ts to stamp missing skill tags.'
      );
    }
  }
  return rows;
}
