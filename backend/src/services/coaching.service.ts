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
- {"kind":"bar-chart","title":"...","xLabel":"...","yLabel":"...","yMax":60,"yTickStep":10,"points":[{"x":"Mon","y":40},...]} (same shape for "line-chart")
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
- READABLE SLICES & ANGLES. Whenever the student must READ or ESTIMATE a slice or angle FROM the pie
  (an unlabelled slice, "what fraction is this?", "estimate the angle"), that amount MUST be an
  intuitive one with a mental shortcut: halves (50% = 180°), quarters (25% = 90°), eighths
  (12.5% = 45°) and their multiples or sums, or clock-face angles (multiples of 30° / 90°). Build the
  WHOLE pie from these clean fractions so the answer the student works out is intuitive too. NEVER
  make the student decipher an awkward slice or angle that has no shortcut (16%, 27%, 33%, 40%, 72° …).
  A slice you LABEL with "showPercent":true may carry a clean arithmetic value (e.g. a 5%-block value)
  since the student reads the number rather than judging the angle by eye.
- MULTI-STEP DATA INTERPRETATION. Clean angles are for READABILITY, never an excuse to make a chart
  question easy. When you build a worked example or Guided-Quiz question on a pie/bar/line/table, make
  it a genuine multi-step NSW-Selective problem, not a one-step read: apply a share to a whole ("360
  people; the 25% slice is how many?"), REVERSE it ("the 90° slice is 60 people — how many in total?"),
  compare or difference two categories AS QUANTITIES, or CHAIN steps (find the missing share, THEN
  apply it to the total). Keep the numbers clean so the arithmetic stays mental, but the reasoning
  must be exam-level.
- AXIS & READABLE VALUES (bar/line charts, W-160). ALWAYS set "yMax" and "yTickStep" so the chart
  draws its own gridlines (yMax must be a whole multiple of yTickStep). Make yTickStep NOT 1 (e.g. 2,
  5, 10, 0.5) so the student has to read the scale. Every plotted value the student reads MUST land on
  a gridline, or at a clean half/quarter step of the spacing — NEVER an awkward spot the eye can't
  place (e.g. 7.5 against a spacing of 10). Keep any value the student computes to AT MOST 2 decimal
  places — never a long or repeating decimal (if an average wouldn't come out clean, choose friendlier
  numbers).
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

// W-159: visual skills whose lessons must teach ON-SCREEN technique — the real test is on a computer
// where the student gets physical scratch paper but CANNOT mark the figure. Keyed by skill slug
// (available at generation time; no schema change). Non-visual (arithmetic/logic) skills are inert.
const VISUAL_SKILL_SLUGS = new Set<string>([
  'reading-tables', 'bar-and-line-graphs', 'pie-charts-proportions', 'two-step-data-problems',
  'measuring-angles', 'estimating-angles', 'angle-types', 'angles-on-lines-and-points',
  'compass-directions', 'grid-references-maps', 'turns-and-bearings', 'grid-logic-deduction',
  'perimeter-rectilinear', 'perimeter-composite-shapes', 'rotating-shapes', 'angle-of-rotation',
  'rotational-symmetry', 'shape-patterns', 'timetable-reading',
  'visual-reasoning', // Thinking Skills
]);

// W-159: named, concrete moves for working a figure ON SCREEN with scratch paper only. The crucial
// rule is MATCH THE TECHNIQUE TO THE FIGURE — the lesson may only name a move that applies to the
// figure it actually shows (e.g. never "read the scale" / "count the gridlines" on a pie, protractor
// or table — they have no axis).
const ON_SCREEN_TECHNIQUE = `ON-SCREEN TECHNIQUE — THIS IS A COMPUTER TEST. The student has physical scratch paper but CANNOT
write on, mark, highlight or annotate the figure on screen. Teach them to pull what they need OFF the
figure onto scratch paper using these named moves:
- "Read the scale first" — before reading any value, work out what ONE gridline/interval is worth and
  where zero is; decide the scale once, then every read is just counting.
- "Anchor and count the gridlines" — never eyeball a position; start from a labelled line/point and
  count whole intervals (or squares) to the target.
- "Jot the sub-answers" — write each value you read on scratch paper as you go, then combine the
  jotted numbers; this is how a multi-step visual problem is solved on screen without marking the figure.
- "One landmark at a time" — track a single corner/dot/arrow through a move, record where it lands,
  then do the next.
- "Say the slice as a clean fraction" — turn an on-screen slice/angle into a clean spoken fraction
  (half, quarter, eighth; 90°, 45°), jot it, then apply.

MATCH THE TECHNIQUE TO THE FIGURE — 100% ACCURACY. Only name the move(s) that actually apply to the
figure you embed; NEVER reference a feature the figure does not have. Use this mapping:
- bar / line graph → Read the scale first + Anchor and count the gridlines + Jot the sub-answers.
- pie chart → Say the slice as a clean fraction + Jot the sub-answers (NO scale or gridlines to read).
- grid / map / compass → Anchor and count the squares + One landmark at a time + Jot the sub-answers.
- protractor / angle figure → Say the angle as a clean fraction (clock face) + Jot the sub-answers
  (NO gridlines).
- rotation / symmetry → One landmark at a time + Jot the sub-answers.
- table / timetable → Anchor to the exact row and column, then Jot the sub-answers (NO scale or
  gridline to read).`;

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
  // W-159: visual skills additionally teach how to work the figure ON SCREEN (scratch paper only).
  const isVisual = VISUAL_SKILL_SLUGS.has(skill.slug);
  const onScreenBlock = isVisual ? `\n${ON_SCREEN_TECHNIQUE}\n` : '';
  const speedScreenDirective = isVisual
    ? ' Because this figure is on a screen the student may not mark, include a one-line "On the screen:" callout that names which of the on-screen moves above to use for THIS figure — showing the student pulling values onto scratch paper (jot the sub-answers) — and referencing only features the figure actually has.'
    : '';
  return `You are an expert primary mathematics tutor specialising in preparing Year 5/6 students for the NSW Selective High School Placement Test. Your teaching philosophy rejects abstract formulas, rote memorisation and slow algorithms. Instead you teach using "Mental Models", "Building Blocks" and "Intuitive Visual Shortcuts" that let a student solve a hard reasoning question mentally in under 45 seconds.

Write a step-by-step lesson and practice set for this ONE ${skillKind}.

Skill / topic: ${skill.name}
What exam-level mastery looks like (tutor notes — translate into kid-friendly teaching, do NOT copy verbatim): ${skill.examLevelNotes}
${misconceptions}${retry}
${MENTAL_MODEL_LIBRARY}
${onScreenBlock}
Structure the lesson EXACTLY as these four sections, in this order, each as a \`##\` heading:

## 1. The Selective Trap
Show a typical NSW Selective-style question for this skill. Explain why the "traditional school method" is too slow or sets a trap under exam pressure.

## 2. The Intuitive Building Block
Explain the concept with a concrete, non-abstract mental model from the library above (money, block-chopping, visual grids, balancing scales, bar models, clock faces…). Do NOT use algebraic formulas yet.

## 3. The Speed Shortcut
Turn that mental model into a rapid mental-maths strategy. Walk through the example step by step, showing exactly what the student should "see" in their head. End with a one-line "Mental Map:" of the chain.${speedScreenDirective}

## 4. Guided Quiz
An INTERACTIVE quiz that makes the student DO the trick — it must not hand them the answer. Give 3 progressive questions. Output EACH question as a fenced code block whose language is "quiz" containing ONE JSON object:

\`\`\`quiz
{"question":"<the question>","hint":"<a tutor nudge that walks them toward the speed trick, using BLANKS like [___] [___] where the key numbers or the answer would go — NEVER fill the numbers in, NEVER reveal the answer>","answer":"<the short final answer, e.g. 20 or 23/40 or 200 m>","acceptable":["<0-2 tolerant variants of the answer>"],"solution":"<the full step-by-step speed solution — this is hidden until the student answers, so it is the ONLY place the working may appear>","figure":<OPTIONAL — a figure object, same format as the figure vocabulary below, shown INSIDE this question>}
\`\`\`

Rules for the quiz:
- The "hint" prompts the METHOD with blanks; it must never contain the answer or the filled-in numbers (write "[___] [___]", not "[Feb 60] [Jan 40]").
- Put ALL the worked steps in "solution" only. Nothing outside the quiz blocks may reveal an answer.
- STATE THE ANSWER UNIT. Every question must tell the student the EXACT unit or form to answer in, so there is no guessing whether to give dollars, a count, a pack size, etc. Write "…what is the lowest total cost, in dollars?" or "…which pack should you buy? Give the pack size as a number." — NOT a bare "which pack is cheapest?" or "what is the cheapest way?" where the expected unit is left implicit. The "answer" must then be a SINGLE clean value in exactly that unit — a number, a fraction, or a number with ONE unit (e.g. "23", "$23", "12", "200 m") — NEVER a mix of units or a value plus a parenthetical (never "$7 (12-pack)"). When several questions in this quiz ask the SAME kind of thing, use the SAME answer form for all of them so the student is not switched between units unexpectedly.
- PER-QUESTION FIGURE — MANDATORY WHEN A QUESTION DESCRIBES A DIAGRAM. If a question mentions a specific pie/chart/graph/slice/sector/angle (e.g. "A pie chart shows Car 40%, Bus 25%, Train ?" or "A slice has angle 54°"), you MUST include a matching "figure" object in THAT question's JSON so the student SEES the picture — NEVER describe a chart in words and leave the figure out. The figure's numbers must match the question exactly; keep it small and relevant. Example of a question that carries its own figure: {"question":"This pie shows Car 40%, Bus 25% and Train (unlabelled). What percent take the Train?","hint":"add the labelled slices [___] + [___], then 100 − [___]","answer":"35","acceptable":["35%"],"solution":"40 + 25 = 65, so Train = 100 − 65 = 35%.","figure":{"kind":"pie-chart","title":"Modes of travel","sectors":[{"label":"Car","percent":40,"showPercent":true},{"label":"Bus","percent":25,"showPercent":true},{"label":"Train","percent":35}]}}. Do NOT reuse the lesson's main figure across questions — only omit per-question figures when EVERY question genuinely uses that ONE shared lesson figure.

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
