import prisma from '../lib/prisma';
import { validateStimulus, StimulusSpec } from '../lib/stimulus';
import { hasDistinctOptions, explanationMatchesKey, keptByEscalation } from '../lib/question-checks';

// Per-role model providers (W-21). Each role — generation, answer-key verification, writing
// analysis — resolves its own {model, baseUrl, apiKey} from role-specific env, falling back
// to the shared OpenAI settings. Because most providers speak the OpenAI-compatible API, a
// role can be pointed at DeepSeek / Gemini(-compat) / OpenRouter / a local server with only
// env vars — no code change. Defaults: generation gpt-5-mini (fast candidate writer), an
// independent o4-mini reasoning auditor for verification (W-21 — cheaper than gpt-5, plenty
// for Year-6 math), gpt-4o-mini for writing analysis.
type ModelRole = 'generation' | 'verification' | 'analysis';

const ROLE_DEFAULTS: Record<ModelRole, string> = {
  generation: 'gpt-5-mini',
  verification: 'o4-mini',
  analysis: 'gpt-4o-mini',
};

export interface ModelProvider {
  model: string;
  baseUrl: string;
  apiKey: string;
}

export function providerFor(role: ModelRole): ModelProvider {
  const R = role.toUpperCase();
  return {
    model: process.env[`${R}_MODEL`] || ROLE_DEFAULTS[role],
    baseUrl: process.env[`${R}_BASE_URL`] || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env[`${R}_API_KEY`] || process.env.OPENAI_API_KEY || '',
  };
}

// Reasoning models reject `temperature` and think inside the completion budget.
const isReasoningModel = (model: string) => /^(gpt-5|o[134])/.test(model);

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function chatCompletion(provider: ModelProvider, prompt: string, maxTokens: number, temperature?: number): Promise<string> {
  if (!provider.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to backend/.env.');
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: maxTokens,
  };
  if (temperature !== undefined && !isReasoningModel(provider.model)) {
    body.temperature = temperature;
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 300);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI API returned an empty response');
  }
  return content;
}

interface AnalysisResult {
  vocabScore: number;
  vocabComments: string;
  structureScore: number;
  structureComments: string;
  contentScore: number;
  contentComments: string;
  overallScore: number;
  summary: string;
}

const ANALYSIS_SCORE_FIELDS = ['vocabScore', 'structureScore', 'contentScore', 'overallScore'] as const;
const ANALYSIS_TEXT_FIELDS = ['vocabComments', 'structureComments', 'contentComments', 'summary'] as const;

// Strict parse: a malformed model response must fail the analysis, never degrade
// into fake scores — failed analyses are not persisted.
function parseAnalysisResponse(content: string): AnalysisResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Analysis response did not contain a JSON object');
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    throw new Error('Analysis response was not valid JSON');
  }

  for (const field of ANALYSIS_SCORE_FIELDS) {
    const value = parsed[field];
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) {
      throw new Error(`Analysis response has a missing or invalid ${field}`);
    }
  }
  for (const field of ANALYSIS_TEXT_FIELDS) {
    if (typeof parsed[field] !== 'string' || (parsed[field] as string).length === 0) {
      throw new Error(`Analysis response has a missing or invalid ${field}`);
    }
  }

  return {
    vocabScore: Math.round(parsed.vocabScore as number),
    vocabComments: parsed.vocabComments as string,
    structureScore: Math.round(parsed.structureScore as number),
    structureComments: parsed.structureComments as string,
    contentScore: Math.round(parsed.contentScore as number),
    contentComments: parsed.contentComments as string,
    overallScore: Math.round(parsed.overallScore as number),
    summary: parsed.summary as string,
  };
}

export async function analyzeAttempt(attemptId: number): Promise<AnalysisResult> {
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    include: { type: true, prompt: true },
  });

  if (!attempt) {
    throw new Error('Attempt not found');
  }

  const prompt = `You are an expert writing tutor for the NSW Selective High School Placement Test.
Analyse the following student's writing piece and provide scores and feedback.

Text Type: ${attempt.type.name}
Expected Structure: ${attempt.type.expectedStructure}
Prompt: ${attempt.prompt.text}

Student's Writing:
---
${attempt.text}
---

Respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "vocabScore": <0-100>,
  "vocabComments": "<specific feedback about vocabulary, referencing the student's actual word choices>",
  "structureScore": <0-100>,
  "structureComments": "<specific feedback about structure and flow, referencing the student's actual structure>",
  "contentScore": <0-100>,
  "contentComments": "<specific feedback about content and how well it follows the expected structure, referencing the student's actual content>",
  "overallScore": <0-100>,
  "summary": "<2-3 sentence summary of the overall performance>"
}

All comments must reference specific parts of the student's text.`;

  const content = await chatCompletion(providerFor('analysis'), prompt, 1000, 0.7);
  return parseAnalysisResponse(content);
}

// One tailored prompt per selected type (H3), index-aligned with the types sorted by name —
// the same order the /generate route returns its `types` array in.
export async function generateWorksheetPrompts(typeIds: number[]): Promise<string[]> {
  const types = await prisma.writingType.findMany({
    where: { id: { in: typeIds } },
    orderBy: { name: 'asc' },
  });

  return Promise.all(
    types.map(async (t) => {
      const prompt = `You are a writing tutor creating practice worksheets for a student preparing for the NSW Selective High School Placement Test.
The student needs practice with this text type:

${t.name}: ${t.expectedStructure}

Generate exactly 1 writing prompt for this text type. It should be a complete, engaging topic suitable for a Year 6 student.
Respond with ONLY a JSON array of strings, no markdown, no code fences:
["prompt text"]`;

      try {
        const content = await chatCompletion(providerFor('generation'), prompt, 2000, 0.8);
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        const parsed = arrayMatch ? JSON.parse(arrayMatch[0]) : [];
        if (Array.isArray(parsed) && typeof parsed[0] === 'string' && parsed[0].trim()) {
          return parsed[0];
        }
        return getFallbackPrompt(t.name);
      } catch (error) {
        console.error(`Worksheet prompt generation failed for ${t.name}:`, error);
        return getFallbackPrompt(t.name);
      }
    })
  );
}

function getFallbackPrompt(typeName: string): string {
  return `Write a ${typeName.toLowerCase()} about a school event that matters to you.`;
}

export type { AnalysisResult };

// ── Math Worksheet Generation ────────────────────────────────────────────────

interface MathTopicForGen {
  id: number;
  name: string;
  slug: string;
  description: string;
  questions: Array<{
    id: number;
    questionText: string;
    options: string;
    correctIndex: number;
    explanation: string;
    percentCorrect: number | null;
  }>;
}

interface GeneratedMathQuestion {
  questionText: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topicSlug: string;
  topicName: string;
  stimulus?: StimulusSpec;
}

// Question text that points at a visual ("shown below", "the graph") is unanswerable
// unless the question actually carries a figure (W-8).
const VISUAL_REFERENCE = /(shown|below|above|diagram|figure|picture|graph|chart|protractor|image)/i;

// One LLM call reliably produces only a handful of long-form questions before drifting
// or stopping short (35 asked, ~25 delivered), so generation runs in small batches and
// tops up until the exact requested count is collected.
const GENERATION_BATCH_SIZE = 10;

// One independent solve on the verification model. Returns the chosen index, -1 for an
// explicit "none of the options is correct", or -1 on any parse/transport failure (so an
// unverifiable question is dropped, never accepted).
async function solveIndependently(q: GeneratedMathQuestion): Promise<number> {
  const stimulusBlock = q.stimulus
    ? `\nStimulus shown to the student (structured figure data — solve using ONLY this data):\n${JSON.stringify(q.stimulus)}\n`
    : '';
  const prompt = `You are independently solving a multiple-choice question to audit its answer key.
${stimulusBlock}
Question:
${q.questionText}

Options (indexed 0-4):
${q.options.map((o, i) => `${i}: ${o}`).join('\n')}

Solve the question yourself, step by step. If exactly one option is correct, give its index.
If NONE of the options is correct, use -1. Respond with ONLY a JSON object (no markdown, no
code fences):
{"correctIndex": <0-4, or -1 if none of the options is correct>}`;

  try {
    const content = await chatCompletion(providerFor('verification'), prompt, 4000);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return -1;
    const verdict = JSON.parse(jsonMatch[0]);
    return Number.isInteger(verdict.correctIndex) ? verdict.correctIndex : -1;
  } catch (error) {
    console.error('Answer-key verification failed:', error);
    return -1;
  }
}

// Escalating-hybrid audit (W-20): a stronger, independent model solves the question. If its
// first solve agrees with the claimed key, accept (one call — the common case). Otherwise
// escalate to two more independent solves and keep only if the key wins a clear majority
// with no "none" verdict. Catches keys the generator got wrong (its correlated verifier
// used to just confirm them).
async function verifyQuestionKey(q: GeneratedMathQuestion): Promise<boolean> {
  const first = await solveIndependently(q);
  if (first === q.correctIndex) return true;
  const [second, third] = await Promise.all([solveIndependently(q), solveIndependently(q)]);
  return keptByEscalation([first, second, third], q.correctIndex);
}

function isValidGeneratedQuestion(q: any, allowedSlugs: Set<string>): boolean {
  const structurallyValid =
    q &&
    typeof q.questionText === 'string' &&
    q.questionText.length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === 5 &&
    q.options.every((o: unknown) => typeof o === 'string' || typeof o === 'number') &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < 5 &&
    typeof q.explanation === 'string' &&
    typeof q.topicSlug === 'string' &&
    allowedSlugs.has(q.topicSlug);
  if (!structurallyValid) return false;

  // A stimulus, if present, must be a well-formed figure spec.
  if (q.stimulus !== undefined && !validateStimulus(q.stimulus)) return false;
  // Guardrail: a question that references a visual must actually carry one.
  if (q.stimulus === undefined && VISUAL_REFERENCE.test(q.questionText)) return false;
  // Deterministic answer-key guards (W-20): no equal-value options, and the explanation
  // must not name a different option than the key.
  if (!hasDistinctOptions(q.options.map(String))) return false;
  if (!explanationMatchesKey(q.explanation, q.correctIndex)) return false;
  return true;
}

async function generateQuestionBatch(topics: MathTopicForGen[], count: number): Promise<any[]> {
  const exemplars = topics.map(t => {
    const hardest = t.questions[0];
    if (!hardest) return null;
    return { topic: t.name, percentCorrect: hardest.percentCorrect, question: hardest.questionText };
  }).filter(Boolean);

  const prompt = `You are a mathematics tutor creating a practice worksheet for a student preparing for the NSW Selective High School Placement Test (Mathematical Reasoning section).

The worksheet should cover the following topic(s):
${topics.map(t => `- ${t.name} (slug: ${t.slug}): ${t.description}`).join('\n')}

Generate exactly ${count} five-option multiple-choice questions distributed across these topics. Each question must have exactly one correct answer and four plausible distractors.

DIFFICULTY REQUIREMENT: Each question must be at or above the difficulty of the hardest known reference question for its topic. Here are the hardest reference questions per topic (with their cohort % Correct — lower % = harder):

${exemplars.map(e => `- ${e!.topic}: ${e!.percentCorrect}% correct (hard). Example: "${e!.question}"`).join('\n')}

For each question, provide a detailed "Question Feedback" style explanation.

READING LEVEL. Write every explanation for a Year 6 student sitting the NSW Selective test.
Use only methods a strong Year 6 student knows — arithmetic, simple fractions and decimals,
diagrams, patterns, and step-by-step logical reasoning. Do NOT use higher-level or
secondary-school tools to explain a primary-level problem (no formal algebra with variables
like x/y, no simultaneous equations, no exponents/roots beyond squares, no trigonometry),
even when they would be shorter. Keep the language plain and the steps small.

VISUAL STIMULI. A question may include an optional "stimulus" field carrying structured
figure data that the app renders as a real image (charts via a chart library, geometry via
SVG). Use one when the topic naturally needs a visual (protractor readings, graphs, grids,
shapes). Format: {"version":1,"text":"<lead-in sentence>","figures":[<figure>]} where a
figure is ONE of:
- {"kind":"protractor","rays":[20,50],"joinPairs":[[20,50]]} — rays at degree marks 0-180
- {"kind":"line-chart","title":"...","xLabel":"...","yLabel":"...","points":[{"x":"9 am","y":0},...]} (same shape for "bar-chart")
- {"kind":"pie-chart","sectors":[{"label":"Rent","percent":27,"showPercent":false},...]} — percents must sum to 100
- {"kind":"table","columns":["Size","Price"],"rows":[["Small",6],...]}
- {"kind":"grid","rows":4,"cols":6,"filled":[[0,2],[1,1]],"rowLabels":["1","2","3","4"],"colLabels":["A","B","C","D","E","F"]}
- {"kind":"compass","facing":"N"}
- {"kind":"shape","unit":"cm","vertices":[[0,0],[12,0],[12,12],[0,12]],"sideLabels":[{"side":0,"label":"12 cm"}]}
- {"kind":"rotation","shape":"arrow","beforeDeg":0,"afterDeg":225}
- {"kind":"cards","values":["4/5","0.15","1/3"]}

HARD RULE: every question must be fully answerable from its questionText plus its own
stimulus. NEVER write "shown below", "in the diagram", "on the protractor" or similar
unless the question includes a stimulus containing that exact figure and all data needed
to solve it. Questions violating this are discarded.

Respond with ONLY a JSON array (no markdown, no code fences) in this exact format:
[
  {
    "questionText": "full question text including any tables or data",
    "options": ["A", "B", "C", "D", "E"],
    "correctIndex": 0,
    "explanation": "Step-by-step reasoning. Therefore, the answer is Option X.",
    "topicSlug": "<slug of this question's topic, one of: ${topics.map(t => t.slug).join(', ')}>",
    "topicName": "<name of this question's topic>",
    "stimulus": <optional, as described above>
  }
]

Generate exactly ${count} questions. Make sure distractors are plausible — they should be answers a student might get from common mistakes.`;

  // Reasoning models think inside the completion budget, so leave generous headroom.
  const content = await chatCompletion(providerFor('generation'), prompt, Math.min(count * 600 + 4000, 16000), 0.8);
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('Generation response did not contain a JSON array');
  }
  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('Generation response was not an array');
  }
  return parsed;
}

export async function generateMathWorksheetQuestions(
  topics: MathTopicForGen[],
  questionCount = 35
): Promise<GeneratedMathQuestion[]> {
  const allowedSlugs = new Set(topics.map(t => t.slug));
  const nameBySlug = new Map(topics.map(t => [t.slug, t.name]));
  const collected: GeneratedMathQuestion[] = [];

  // Verification drops some candidates, so allow extra top-up calls.
  const maxCalls = Math.ceil(questionCount / GENERATION_BATCH_SIZE) + 5;
  let failedCalls = 0;

  for (let call = 0; call < maxCalls && collected.length < questionCount; call++) {
    const need = Math.min(GENERATION_BATCH_SIZE, questionCount - collected.length);
    try {
      const batch = await generateQuestionBatch(topics, need);
      const candidates: GeneratedMathQuestion[] = batch
        .filter(q => isValidGeneratedQuestion(q, allowedSlugs) && hasDistinctOptions(q.options.map(String)))
        .map(q => ({
          questionText: q.questionText,
          options: q.options.map(String),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          topicSlug: q.topicSlug,
          topicName: nameBySlug.get(q.topicSlug)!,
          ...(q.stimulus !== undefined ? { stimulus: q.stimulus } : {}),
        }));

      // Audit every candidate's answer key in parallel; keep only confirmed ones.
      const verdicts = await Promise.all(candidates.map(verifyQuestionKey));
      const verified = candidates
        .filter((_, i) => verdicts[i])
        .slice(0, questionCount - collected.length);
      collected.push(...verified);
    } catch (error) {
      failedCalls++;
      console.error('Math worksheet generation batch failed:', error);
    }
  }

  // Provider never produced anything (e.g. no API key): keep the offline fallback so
  // the review flow still works — the admin sees obvious placeholders before saving.
  if (collected.length === 0 && failedCalls > 0) {
    return getFallbackMathQuestions(topics, questionCount);
  }
  if (collected.length < questionCount) {
    throw new Error(`Only generated ${collected.length} of ${questionCount} questions. Please try again.`);
  }
  return collected;
}

function getFallbackMathQuestions(topics: MathTopicForGen[], questionCount = 35): GeneratedMathQuestion[] {
  const fallback: GeneratedMathQuestion[] = [];
  const topicNames = topics.map(t => ({ slug: t.slug, name: t.name }));

  for (let i = 0; i < questionCount; i++) {
    const t = topicNames[i % topicNames.length];
    fallback.push({
      questionText: `Sample question ${i + 1} for ${t.name}. What is the value of 25 × 4?`,
      options: ['80', '100', '120', '125', '150'],
      correctIndex: 1,
      explanation: '25 × 4 = 100. Therefore, the answer is Option B.',
      topicSlug: t.slug,
      topicName: t.name,
    });
  }

  return fallback;
}
