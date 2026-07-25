import { providerFor, chatCompletion } from './ai.service';

// M3c Phase 2 (W-63): generate a coaching lesson for one skill, then check the arithmetic of its
// worked examples with the independent verification role, retrying generation exactly once if the
// verifier flags anything. The generation and verifier PROMPTS are judgment work (§11) — authored
// here, never delegated to a weaker model. The control flow (one retry, then save + flag) is what
// the unit tests pin down.

export interface CoachingSkillInput {
  name: string;
  slug: string;
  examLevelNotes: string;
  misconceptions?: string[];
}

export interface GeneratedModule {
  title: string;
  content: string;
  verifierWarnings: string[];
}

// The exact section order a module must follow (§8.1). "Speed technique" is omitted by the model
// when no shortcut applies.
const SECTION_GUIDE =
  '## The idea\n## Step by step\n## Speed technique (omit this heading entirely if there is no genuine shortcut)\n## Worked examples\n## Traps to avoid';

function generationPrompt(skill: CoachingSkillInput, feedback?: string[]): string {
  const misconceptions =
    skill.misconceptions && skill.misconceptions.length > 0
      ? `\nCommon mistakes students make on this skill (turn these into the "Traps to avoid"):\n- ${skill.misconceptions.join('\n- ')}\n`
      : '';
  const retry =
    feedback && feedback.length > 0
      ? `\nA maths checker found errors in your previous attempt. FIX these — recompute every worked example so the arithmetic is correct:\n- ${feedback.join('\n- ')}\n`
      : '';
  return `You are writing a short coaching lesson for an 11-year-old preparing for the NSW Selective High School Placement Test. The lesson teaches ONE maths skill.

Skill: ${skill.name}
What exam-level mastery looks like (tutor notes — do NOT copy verbatim, translate into kid-friendly teaching): ${skill.examLevelNotes}
${misconceptions}${retry}
Write it FOR the student, not the tutor:
- Talk straight to them ("you"), short sentences, a warm and encouraging tone. Never babyish, never a wall of text.
- Make the speed technique feel like a trick worth showing off. Frame the traps as "gotchas the test setters hope you fall for".
- Keep it under a 5-minute read. Use concrete, relatable numbers in every example.
- Every worked example must be arithmetically correct — double-check each calculation before you finish.

Output ONLY GitHub-flavoured markdown with these sections, in this exact order (no preamble, no code fences):
${SECTION_GUIDE}

Include 2–3 worked examples under "## Worked examples".`;
}

function verifierPrompt(content: string): string {
  return `You are a careful maths checker. Below is a coaching lesson in markdown. Check ONLY the arithmetic of every worked example (each computation, each intermediate step, each final answer). Ignore tone, wording, spelling, and teaching style.

Lesson:
"""
${content}
"""

Respond with ONLY a JSON object (no markdown, no code fences) in this exact shape:
{"ok": true}  if every calculation is correct, or
{"ok": false, "warnings": ["Worked example 2: 7×8 is 56, not 54", ...]}  listing each arithmetic error you found.`;
}

// Exported for direct unit testing. Fails OPEN: if the verifier's reply can't be parsed, return no
// warnings — the admin still reviews and approves every draft, so a parser miss never blocks or
// silently corrupts the lesson.
export async function verifyWorkedExamples(content: string): Promise<string[]> {
  const { content: raw } = await chatCompletion(providerFor('verification'), verifierPrompt(content), 2000);
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const verdict = JSON.parse(match[0]) as { ok?: boolean; warnings?: string[] };
    if (verdict.ok) return [];
    return Array.isArray(verdict.warnings) && verdict.warnings.length > 0
      ? verdict.warnings
      : ['The maths checker flagged a worked example.'];
  } catch {
    return [];
  }
}

async function generateOnce(skill: CoachingSkillInput, feedback?: string[]): Promise<string> {
  const { content } = await chatCompletion(providerFor('generation'), generationPrompt(skill, feedback), 3000, 0.7);
  return content.trim();
}

export async function generateCoachingModuleContent(skill: CoachingSkillInput): Promise<GeneratedModule> {
  let content = await generateOnce(skill);
  let warnings = await verifyWorkedExamples(content);
  if (warnings.length > 0) {
    // Exactly one retry, feeding the verifier's findings back into generation.
    content = await generateOnce(skill, warnings);
    warnings = await verifyWorkedExamples(content);
  }
  return { title: skill.name, content, verifierWarnings: warnings };
}
