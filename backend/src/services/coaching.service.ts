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

// The lesson-generation prompt. Lessons follow the Selective-exam "tactics" structure (Selective
// Trap → Intuitive Building Block → Speed Shortcut → interactive Guided Quiz) and draw on a library
// of named, concrete mental models. This is the ONLY lesson style (W-123 — the earlier Standard/
// Tactical A/B was collapsed to this one).

// Named concrete mental models the author should reach for (user-curated). The AI picks the one that
// fits the skill, or invents an equally concrete model in the same spirit.
const MENTAL_MODEL_LIBRARY = `MENTAL MODEL LIBRARY — reach for the concrete model that fits this skill (or invent one just as
physical and visual, never an abstract formula):
- Patterns / Magic Squares → the "Balance Scale" or "Averages as the Anchor" method (find the centre/
  average and balance around it), NOT guess-and-check.
- Angles / Protractor / Directions → the "Clock Face Analogy": 90° = 3 hours, 30° = 1 hour, so a turn
  is read off the clock instantly without a physical protractor.
- Time / Time Zones → a "Number Line Timeline": put a zero-anchor down and physically step left/right,
  instead of adding and subtracting raw times (which causes carrying errors).
- Algebra / unknowns → the "Box and Apple" or Singapore-style "Bar Model": draw the unknown as a box
  or bar before any letters like x or y.
- Fractions / Percentages / Ratios → "Building Blocks": find the smallest CLEAN block that divides
  both numbers into whole numbers, then scale one block up.
- Money / sharing → coin and note analogies; comparisons → line the amounts up and compare, don't compute.`;

function generationPrompt(skill: CoachingSkillInput, subject: CoachingSubject, feedback?: string[]): string {
  const ts = subject === 'thinking-skills';
  const skillKind = ts ? 'Thinking Skills reasoning skill' : 'maths skill';
  const misconceptions =
    skill.misconceptions && skill.misconceptions.length > 0
      ? `\nCommon mistakes to turn into traps/hints:\n- ${skill.misconceptions.join('\n- ')}\n`
      : '';
  const retry =
    feedback && feedback.length > 0
      ? ts
        ? `\nA reviewer found problems in your previous attempt. FIX these — rework every drill so the reasoning is sound:\n- ${feedback.join('\n- ')}\n`
        : `\nA maths checker found errors in your previous attempt. FIX these — recompute every drill so the arithmetic is correct:\n- ${feedback.join('\n- ')}\n`
      : '';
  const correctnessLine = ts
    ? 'Every drill must be logically sound — double-check the reasoning in each.'
    : 'Every drill must be arithmetically correct — double-check each calculation, and prefer clean ratios and multipliers over decimals or heavy division.';
  return `You are an expert primary mathematics tutor specialising in preparing Year 5/6 students for the NSW Selective High School Placement Test. Your teaching philosophy rejects abstract formulas, rote memorisation and slow algorithms. Instead you teach using "Mental Models", "Building Blocks" and "Intuitive Visual Shortcuts" that let a student solve a hard reasoning question mentally in under 45 seconds.

Write a step-by-step lesson and practice set for this ONE ${skillKind}.

Skill / topic: ${skill.name}
What exam-level mastery looks like (tutor notes — translate into kid-friendly teaching, do NOT copy verbatim): ${skill.examLevelNotes}
${misconceptions}${retry}
${MENTAL_MODEL_LIBRARY}

Structure the lesson EXACTLY as these four sections, in this order, each as a \`##\` heading:

## 1. The Selective Trap
Show a typical NSW Selective-style question for this skill. Explain why the "traditional school method" is too slow or sets a trap under exam pressure.

## 2. The Intuitive Building Block
Explain the concept with a concrete, non-abstract mental model from the library above (money, block-chopping, visual grids, balancing scales, bar models, clock faces…). Do NOT use algebraic formulas yet.

## 3. The Speed Shortcut
Turn that mental model into a rapid mental-maths strategy. Walk through the example step by step, showing exactly what the student should "see" in their head. End with a one-line "Mental Map:" of the chain.

## 4. Guided Quiz
An INTERACTIVE quiz that makes the student DO the trick — it must not hand them the answer. Give 3 progressive questions. Output EACH question as a fenced code block whose language is "quiz" containing ONE JSON object:

\`\`\`quiz
{"question":"<the question>","hint":"<a tutor nudge that walks them toward the speed trick, using BLANKS like [___] [___] where the key numbers or the answer would go — NEVER fill the numbers in, NEVER reveal the answer>","answer":"<the short final answer, e.g. 20 or 23/40 or 200 m>","acceptable":["<0-2 tolerant variants of the answer>"],"solution":"<the full step-by-step speed solution — this is hidden until the student answers, so it is the ONLY place the working may appear>","figure":<OPTIONAL — a figure object, same format as the figure vocabulary below, shown INSIDE this question>}
\`\`\`

Rules for the quiz:
- The "hint" prompts the METHOD with blanks; it must never contain the answer or the filled-in numbers (write "[___] [___]", not "[Feb 60] [Jan 40]").
- Put ALL the worked steps in "solution" only. Nothing outside the quiz blocks may reveal an answer.
- Keep "answer" short and clean (a number, a fraction, or a number with a unit).
- PER-QUESTION FIGURE: if a question refers to its OWN specific diagram (e.g. "a pie chart shows Car 40%, Bus 25%, Train ?"), embed that diagram as the question's "figure" so the student sees it right there — do NOT describe a chart in words and leave it out. Keep each figure small and directly relevant. Do NOT reuse the lesson's main figure across questions: only omit per-question figures when EVERY question genuinely uses that ONE shared lesson figure.

Talk straight to the student ("you"), short sentences, warm, encouraging, highly tactical. ${correctnessLine}

${LESSON_FIGURE_VOCAB}

Output ONLY GitHub-flavoured markdown with those four \`##\` sections (no preamble, and no code fences EXCEPT the \`\`\`figure and \`\`\`quiz blocks described above).`;
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
// lesson (4 sections + an interactive quiz + figures) is long, so this budget gives comfortable
// headroom to avoid truncating to empty content (W-115/W-118).
const GENERATION_MAX_TOKENS = 12000;

async function generateOnce(
  skill: CoachingSkillInput,
  subject: CoachingSubject,
  feedback?: string[],
): Promise<string> {
  const { content } = await chatCompletion(
    providerFor('generation'),
    generationPrompt(skill, subject, feedback),
    GENERATION_MAX_TOKENS,
    0.7,
  );
  return content.trim();
}

export async function generateCoachingModuleContent(
  skill: CoachingSkillInput,
  subject: CoachingSubject = 'math',
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
