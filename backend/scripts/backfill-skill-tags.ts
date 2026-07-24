// M3a Task 9 — one-off backfill of skill tags for pre-taxonomy content.
//
// Run from backend/:   npx tsx scripts/backfill-skill-tags.ts [--dry-run]
//
// Two passes:
//   1. Bank questions — every MathQuestion with skillId IS NULL AND worksheetId IS NULL is
//      tagged by the analysis-role model against its topic's closed skill list
//      (prisma/seed-skills.ts), then confirmed by the verification-role model (Y/N). On any
//      failure (bad slug, N verdict, transport error) the topic's FIRST skill is used as a
//      fallback and a `[backfill] WARN` line is logged.
//   2. Legacy worksheet blobs — MathWorksheet.questions JSON elements that lack a skillSlug
//      are stamped: resolved from the worksheet's persisted MathQuestion rows when those
//      exist and carry a skill, otherwise AI-tagged exactly like bank questions.
//
// --dry-run makes NO AI calls and writes NOTHING: it enumerates the work, resolves what can
// be resolved offline (worksheet rows), and prints the plan with "(ai)" where a real run
// would call the model. Environment (API keys, DATABASE_URL) is read via dotenv from
// backend/.env exactly like the backend itself; no key values are ever printed.

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { MATH_SKILLS } from '../prisma/seed-skills';
import { chatCompletion, providerFor } from '../src/services/ai.service';
import { parseBareSlug, parseYesNo, indicesMissingSkillSlug, formatSummaryTable, SummaryRow } from './backfill-lib';

const DRY_RUN = process.argv.includes('--dry-run');
const AI_PENDING = '(ai)'; // dry-run placeholder for a slug a real run would get from the model

function warn(message: string): void {
  console.warn(`[backfill] WARN ${message}`);
}

interface TaggableQuestion {
  label: string; // e.g. "bank Q12" / "worksheet 3 blob[4]"
  topicSlug: string;
  topicName: string;
  questionText: string;
  options: string[];
  explanation: string;
}

async function aiProposeSlug(q: TaggableQuestion, allowed: Set<string>): Promise<string | null> {
  const skills = MATH_SKILLS[q.topicSlug] ?? [];
  const prompt = `You are auditing a question bank for the NSW Selective Placement Test (Mathematical Reasoning).
Tag the following multiple-choice question with the single skill it most directly tests.

Topic: ${q.topicName}

Question:
${q.questionText}

Options (indexed 0-${q.options.length - 1}):
${q.options.map((o, i) => `${i}: ${o}`).join('\n')}

Explanation of the intended solution:
${q.explanation}

The topic's closed skill list (slug: name):
${skills.map((s) => `- ${s.slug}: ${s.name}`).join('\n')}

Respond with ONLY the chosen slug on a single line — no JSON, no quotes, no explanation.`;

  const { content } = await chatCompletion(providerFor('analysis'), prompt, 500, 0);
  return parseBareSlug(content, allowed);
}

async function aiConfirmSlug(q: TaggableQuestion, slug: string): Promise<boolean | null> {
  const skills = MATH_SKILLS[q.topicSlug] ?? [];
  const chosen = skills.find((s) => s.slug === slug);
  const prompt = `You are independently verifying a skill tag on a multiple-choice question for the NSW Selective Placement Test (Mathematical Reasoning).

Question:
${q.questionText}

Explanation of the intended solution:
${q.explanation}

The topic "${q.topicName}" has this closed skill list (slug: name):
${skills.map((s) => `- ${s.slug}: ${s.name}`).join('\n')}

Proposed tag: ${slug}${chosen ? ` (${chosen.name})` : ''}

Is the proposed tag the single skill from the list that this question most directly tests? Respond with ONLY Y or N.`;

  // Verification may be a reasoning model that thinks inside the completion budget.
  const { content } = await chatCompletion(providerFor('verification'), prompt, 2000);
  return parseYesNo(content);
}

// Full tag pipeline for one question: propose → confirm → fallback. Returns the slug to
// use plus how it was decided. In dry-run mode no AI is called and the slug is AI_PENDING.
async function resolveSlugViaAi(q: TaggableQuestion): Promise<{ slug: string; source: 'ai' | 'fallback' | 'dry' } | null> {
  const skills = MATH_SKILLS[q.topicSlug] ?? [];
  if (skills.length === 0) {
    warn(`${q.label}: topic "${q.topicSlug}" has no skill list — cannot tag, skipping`);
    return null;
  }
  const fallback = skills[0].slug;
  if (DRY_RUN) return { slug: AI_PENDING, source: 'dry' };

  const allowed = new Set(skills.map((s) => s.slug));
  try {
    const proposed = await aiProposeSlug(q, allowed);
    if (!proposed) {
      warn(`${q.label}: tagging model did not return a valid slug — falling back to "${fallback}"`);
      return { slug: fallback, source: 'fallback' };
    }
    const confirmed = await aiConfirmSlug(q, proposed);
    if (confirmed !== true) {
      warn(`${q.label}: verifier ${confirmed === false ? 'rejected' : 'gave no verdict on'} "${proposed}" — falling back to "${fallback}"`);
      return { slug: fallback, source: 'fallback' };
    }
    return { slug: proposed, source: 'ai' };
  } catch (error) {
    warn(`${q.label}: AI call failed (${(error as Error).message}) — falling back to "${fallback}"`);
    return { slug: fallback, source: 'fallback' };
  }
}

function addSummary(rows: SummaryRow[], topic: string, slug: string): void {
  const existing = rows.find((r) => r.topic === topic && r.slug === slug);
  if (existing) existing.count += 1;
  else rows.push({ topic, slug, count: 1 });
}

function safeParseArray(raw: string): unknown[] | null {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ── Pass 1: bank questions ───────────────────────────────────────────────────

async function backfillBankQuestions(summary: SummaryRow[]): Promise<void> {
  const untagged = await prisma.mathQuestion.findMany({
    where: { skillId: null, worksheetId: null },
    include: { topic: true },
    orderBy: { id: 'asc' },
  });
  console.log(`\nPass 1 — bank questions: ${untagged.length} untagged (skillId IS NULL AND worksheetId IS NULL)`);

  for (const question of untagged) {
    const q: TaggableQuestion = {
      label: `bank Q${question.id}`,
      topicSlug: question.topic.slug,
      topicName: question.topic.name,
      questionText: question.questionText,
      options: safeParseArray(question.options)?.map(String) ?? [],
      explanation: question.explanation,
    };
    const result = await resolveSlugViaAi(q);
    if (!result) continue;

    console.log(`  ${q.label} (${q.topicSlug}) → ${result.slug}${result.source === 'fallback' ? ' [fallback]' : ''}`);
    addSummary(summary, q.topicSlug, result.slug);

    if (!DRY_RUN) {
      const skill = await prisma.skill.findUnique({ where: { slug: result.slug } });
      if (!skill) {
        warn(`${q.label}: skill "${result.slug}" is not seeded — run the skill seed first; not writing`);
        continue;
      }
      await prisma.mathQuestion.update({ where: { id: question.id }, data: { skillId: skill.id } });
    }
  }
}

// ── Pass 2: legacy worksheet question blobs ──────────────────────────────────

async function backfillWorksheetBlobs(summary: SummaryRow[]): Promise<void> {
  const worksheets = await prisma.mathWorksheet.findMany({
    include: { questionRows: { include: { skill: true }, orderBy: { id: 'asc' } } },
    orderBy: { id: 'asc' },
  });

  let touched = 0;
  for (const ws of worksheets) {
    const blob = safeParseArray(ws.questions);
    if (blob === null) {
      warn(`worksheet ${ws.id} ("${ws.title}"): questions blob is not a JSON array — skipping`);
      continue;
    }
    const missing = indicesMissingSkillSlug(blob);
    if (missing.length === 0) continue;
    touched += 1;
    console.log(`\nPass 2 — worksheet ${ws.id} ("${ws.title}"): ${missing.length} of ${blob.length} blob question(s) lack skillSlug`);

    let stamped = 0;
    for (const i of missing) {
      const el = blob[i] as Record<string, unknown>;
      const label = `worksheet ${ws.id} blob[${i}]`;
      const topicSlug = typeof el.topicSlug === 'string' ? el.topicSlug : '';

      // Prefer the worksheet's persisted rows: match by question text, or by position when
      // the row count mirrors the blob (rows are created in authored order).
      const rowMatch =
        ws.questionRows.find((r) => r.questionText === el.questionText) ??
        (ws.questionRows.length === blob.length ? ws.questionRows[i] : undefined);

      let slug: string | null = null;
      if (rowMatch?.skill?.slug) {
        slug = rowMatch.skill.slug;
        console.log(`  ${label} (${topicSlug}) → ${slug} [from persisted row ${rowMatch.id}]`);
      } else {
        const q: TaggableQuestion = {
          label,
          topicSlug,
          topicName: typeof el.topicName === 'string' ? el.topicName : topicSlug,
          questionText: String(el.questionText ?? ''),
          options: Array.isArray(el.options) ? el.options.map(String) : [],
          explanation: String(el.explanation ?? ''),
        };
        const result = await resolveSlugViaAi(q);
        if (!result) continue;
        slug = result.slug;
        console.log(`  ${label} (${topicSlug}) → ${slug}${result.source === 'fallback' ? ' [fallback]' : ''}`);
      }

      addSummary(summary, topicSlug || '(unknown-topic)', slug);
      if (slug !== AI_PENDING) {
        el.skillSlug = slug;
        stamped += 1;
      }
    }

    if (!DRY_RUN && stamped > 0) {
      await prisma.mathWorksheet.update({ where: { id: ws.id }, data: { questions: JSON.stringify(blob) } });
    }
  }
  if (touched === 0) console.log('\nPass 2 — worksheet blobs: nothing to do (every blob question already has a skillSlug)');
}

async function main(): Promise<void> {
  console.log(`backfill-skill-tags ${DRY_RUN ? '(DRY RUN — no AI calls, no writes; AI-decided slugs shown as "(ai)")' : '(REAL RUN — AI tagging + database writes)'}`);

  const summary: SummaryRow[] = [];
  await backfillBankQuestions(summary);
  await backfillWorksheetBlobs(summary);

  console.log('\nSummary (topic → slug → count):');
  console.log(summary.length ? formatSummaryTable(summary) : '  nothing to backfill');
  if (DRY_RUN) console.log('\nDry run complete — database unchanged.');
}

main()
  .catch((error) => {
    console.error('backfill-skill-tags failed:', error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
