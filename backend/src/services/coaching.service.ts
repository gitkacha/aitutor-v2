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

// Lessons may embed a REAL figure the app renders (charts via a chart library, geometry via SVG) by
// writing a fenced ```figure block containing ONE figure JSON object. This vocabulary is a
// deliberately SEPARATE copy of the MCQ generator's figure list (ai.service.ts) — the MCQ prompt
// must stay byte-for-byte unchanged (W-115), so the two are not shared.
const LESSON_FIGURE_VOCAB = `SHOW, DON'T JUST TELL. When the skill is visual or quantitative, EMBED the actual picture the
student would see, then teach on top of it. Write a figure as a fenced code block whose language is
"figure" containing ONE figure JSON object, e.g.:

\`\`\`figure
{"kind":"pie-chart","title":"Where Sam's money goes","sectors":[{"label":"Rent","percent":50,"showPercent":true},{"label":"Food","percent":30},{"label":"Fun","percent":20}]}
\`\`\`

A figure is ONE of:
- {"kind":"pie-chart","title":"...","sectors":[{"label":"Rent","percent":50,"showPercent":true},...]} — percents sum to 100
- {"kind":"bar-chart","title":"...","xLabel":"...","yLabel":"...","points":[{"x":"Mon","y":4},...]} (same shape for "line-chart")
- {"kind":"table","columns":["Size","Price"],"rows":[["Small",6],...]}
- {"kind":"grid","rows":4,"cols":4,"filled":[[0,2],[1,1]],"rowLabels":["1","2","3","4"],"colLabels":["A","B","C","D"]}
- {"kind":"shape","unit":"cm","vertices":[[0,0],[12,0],[12,12],[0,12]],"sideLabels":[{"side":0,"label":"12 cm"}]}
- {"kind":"cards","values":["4/5","0.15","1/3"]}

Rules for figures:
- Put a figure in "The idea" to show what these questions look like, and REUSE the same figure inside
  a worked example so the student watches the trick land on the real picture.
- Right after each figure, point at exactly what to notice ("look at the biggest slice — that's over
  half already").
- Use "showPercent":true only on the one or two sectors the trick depends on, so the key numbers pop.
- Only embed a figure when it genuinely helps. A pure-reasoning skill (logic, deduction, spotting a
  flaw in an argument) needs no chart — do NOT invent one.`;

type CoachingSubject = 'math' | 'thinking-skills';

function generationPrompt(skill: CoachingSkillInput, subject: CoachingSubject, feedback?: string[]): string {
  const ts = subject === 'thinking-skills';
  const misconceptions =
    skill.misconceptions && skill.misconceptions.length > 0
      ? `\nCommon mistakes students make on this skill (turn these into the "Traps to avoid"):\n- ${skill.misconceptions.join('\n- ')}\n`
      : '';
  const retry =
    feedback && feedback.length > 0
      ? ts
        ? `\nA reviewer found problems in your previous attempt. FIX these — rework every worked example so the reasoning is sound:\n- ${feedback.join('\n- ')}\n`
        : `\nA maths checker found errors in your previous attempt. FIX these — recompute every worked example so the arithmetic is correct:\n- ${feedback.join('\n- ')}\n`
      : '';
  // The skill kind + the two subject-specific bullet lines are the only differences; the math path
  // reproduces the original prompt verbatim (W-110).
  const skillKind = ts ? 'Thinking Skills reasoning skill' : 'maths skill';
  const concreteLine = ts
    ? 'Keep it under a 5-minute read. Use a concrete, relatable example every time.'
    : 'Keep it under a 5-minute read. Use concrete, relatable numbers in every example.';
  const correctnessLine = ts
    ? 'Every worked example must be logically sound — double-check the reasoning in each before you finish.'
    : 'Every worked example must be arithmetically correct — double-check each calculation before you finish.';
  return `You are writing a short coaching lesson for an 11-year-old preparing for the NSW Selective High School Placement Test. The lesson teaches ONE ${skillKind}.

Skill: ${skill.name}
What exam-level mastery looks like (tutor notes — do NOT copy verbatim, translate into kid-friendly teaching): ${skill.examLevelNotes}
${misconceptions}${retry}
Write it FOR the student, not the tutor:
- Talk straight to them ("you"), short sentences, a warm and encouraging tone. Never babyish, never a wall of text.
- Make the speed technique feel like a trick worth showing off. Frame the traps as "gotchas the test setters hope you fall for".
- ${concreteLine}
- ${correctnessLine}

TEACH IT SO IT STICKS. Build the whole lesson around three moves, in this order:
1. WHAT TO LOOK FOR — the tell-tale signs that a question is "one of these", so the student recognises
   the type instantly.
2. WHAT IT MEANS HERE — take a real example and read it out loud: what each number/clue/figure is
   actually saying.
3. HOW TO APPLY THE TRICK FAST — walk through solving it quickly using the shortcut.
Map these onto the sections: "The idea" = what to look for; "Step by step" = what it means here; "Speed
technique" + "Worked examples" = applying the trick fast.

MAKE THE MATHS INTUITIVE. Prefer shortcuts a human brain finds natural over grinding calculation:
estimate and round, lean on friendly benchmarks (10%, 25%, 50%, doubling/halving), compare instead of
compute, eliminate impossible options, and use symmetry or patterns. If a slow calculation can be
skipped, show the student how to skip it — that is the trick worth showing off.

USE THE "BUILDING BLOCKS" METHOD for percentages, proportions, ratios and unit-rate problems. Find
the SMALLEST CLEAN BUILDING BLOCK — the biggest single step that divides BOTH the given amount and
the given percent/quantity into WHOLE NUMBERS — then scale that one block up to the answer. Pick the
block to fit the numbers in the question; do NOT blindly reach for 10% when it makes an ugly fraction.
Picture it physically: "imagine the total is hidden in a number of identical boxes — just find how
many are in one box, then count the boxes." Worked example to copy the STYLE of (not the numbers):
- "15% of the visitors is 18 people. How many visitors in total?" 15 and 18 both divide by 3, so use
  5% as the block: chop 15% into three 5% pieces, and 18 into three equal pieces → 18 ÷ 3 = 6, so
  5% = 6 people. 100% is twenty 5%-blocks → 6 × 20 = 120 visitors.
Every intermediate number MUST stay a whole number. NEVER leave an awkward step like "18 × (10/15)" or
a messy fraction in a worked example when a whole-number building block exists — that is exactly the
slow, un-intuitive move to avoid.

${LESSON_FIGURE_VOCAB}

Output ONLY GitHub-flavoured markdown with these sections, in this exact order (no preamble, and no
code fences EXCEPT the \`\`\`figure blocks described above):
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

// On a reasoning model (gpt-5-mini) the completion budget is spent on reasoning AND output. The
// richer visual lessons (figures + the what-to-look-for → shortcut framework) pushed the old 3000
// budget to its edge (~2.5k used per run), so a slightly longer run truncated and returned empty
// content. 8000 gives comfortable headroom for reasoning + a full lesson (W-115 fix).
const GENERATION_MAX_TOKENS = 8000;

async function generateOnce(skill: CoachingSkillInput, subject: CoachingSubject, feedback?: string[]): Promise<string> {
  const { content } = await chatCompletion(providerFor('generation'), generationPrompt(skill, subject, feedback), GENERATION_MAX_TOKENS, 0.7);
  return content.trim();
}

export async function generateCoachingModuleContent(
  skill: CoachingSkillInput,
  subject: CoachingSubject = 'math'
): Promise<GeneratedModule> {
  let content = await generateOnce(skill, subject);
  // The arithmetic verifier is meaningful only for maths worked examples. Thinking Skills lessons
  // teach reasoning (no arithmetic to check) — they rely on admin review, matching the fails-open
  // design (W-110).
  if (subject !== 'math') {
    return { title: skill.name, content, verifierWarnings: [] };
  }
  let warnings = await verifyWorkedExamples(content);
  if (warnings.length > 0) {
    // Exactly one retry, feeding the verifier's findings back into generation.
    content = await generateOnce(skill, subject, warnings);
    warnings = await verifyWorkedExamples(content);
  }
  return { title: skill.name, content, verifierWarnings: warnings };
}
