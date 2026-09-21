import prisma from '../lib/prisma';
import { checkGridCompassDirection } from '../lib/grid-compass';
import { validateStimulus, StimulusSpec } from '../lib/stimulus';
import { hasDistinctOptions, explanationMatchesKey, keptByEscalation } from '../lib/question-checks';
import { balanceAnswerPositions } from '../lib/answer-balance';
import { MATH_SKILLS, WRITING_SKILLS, THINKING_SKILLS } from '../../prisma/seed-skills';
import { buildTopicBriefSection } from './topic-briefs';

// Per-role model providers (W-21). Each role — generation, answer-key verification, writing
// analysis — resolves its own {model, baseUrl, apiKey} from role-specific env, falling back
// to the shared OpenAI settings. Because most providers speak the OpenAI-compatible API, a
// role can be pointed at DeepSeek / Gemini(-compat) / OpenRouter / a local server with only
// env vars — no code change. Defaults: generation gpt-5-mini (fast candidate writer), an
// independent o4-mini reasoning auditor for verification (W-21 — cheaper than gpt-5, plenty
// for Year-6 math), gpt-4o-mini for writing analysis.
type ModelRole = 'generation' | 'verification' | 'analysis' | 'chat';

const ROLE_DEFAULTS: Record<ModelRole, string> = {
  generation: 'gpt-5-mini',
  verification: 'o4-mini',
  analysis: 'gpt-4o-mini',
  chat: 'gpt-5-mini',
};

type TokensParam = 'max_completion_tokens' | 'max_tokens';

export interface ModelProvider {
  model: string;
  baseUrl: string;
  apiKey: string;
  tokensParam: TokensParam;
}

// OpenAI's own API (and its newer reasoning models) use `max_completion_tokens`; other
// OpenAI-compatible providers (DeepSeek, Gemini's compat endpoint, most local servers)
// expect the older `max_tokens` (W-22). Overridable per role via ${ROLE}_TOKENS_PARAM.
function defaultTokensParam(baseUrl: string): TokensParam {
  return baseUrl.includes('api.openai.com') ? 'max_completion_tokens' : 'max_tokens';
}

export function providerFor(role: ModelRole): ModelProvider {
  const R = role.toUpperCase();
  const baseUrl = process.env[`${R}_BASE_URL`] || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
  const override = process.env[`${R}_TOKENS_PARAM`];
  return {
    model: process.env[`${R}_MODEL`] || ROLE_DEFAULTS[role],
    baseUrl,
    apiKey: process.env[`${R}_API_KEY`] || process.env.OPENAI_API_KEY || '',
    tokensParam: override === 'max_tokens' || override === 'max_completion_tokens' ? override : defaultTokensParam(baseUrl),
  };
}

// Reasoning models reject `temperature` and think inside the completion budget.
const isReasoningModel = (model: string) => /^(gpt-5|o[134])/.test(model);

// W-144: a single OpenAI call must not hang forever. A briefed reasoning-model batch legitimately
// takes ~1-2 min, so the ceiling is generous; a genuinely hung socket aborts and the caller's
// retry path recovers. Override with OPENAI_TIMEOUT_MS.
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 180_000;

interface ChatCompletionResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface CompletionResult {
  content: string;
  usage: Usage | null;
}

// Model output should never contain raw control characters; a stray one (seen from a
// reasoning model) breaks strict JSON parsing and can persist into a question/explanation.
// Strip them, keeping ordinary whitespace (tab/newline/carriage-return) (W-24).
function stripControlChars(s: string): string {
  let out = '';
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    // Keep tab (9), newline (10), carriage return (13); drop other C0/C1 control chars.
    if (c >= 32 || c === 9 || c === 10 || c === 13) out += ch;
  }
  return out;
}

export async function chatCompletion(provider: ModelProvider, prompt: string, maxTokens: number, temperature?: number): Promise<CompletionResult> {
  if (!provider.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to backend/.env.');
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: [{ role: 'user', content: prompt }],
    [provider.tokensParam]: maxTokens,
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
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS), // W-144: fail a hung call fast
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 300);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error('OpenAI API returned an empty response');
  }
  const usage: Usage | null = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      }
    : null;
  // Per-call token/cost logging (W-23).
  console.log('[ai-usage]', JSON.stringify({ model: provider.model, ...(usage || { totalTokens: null }) }));
  return { content: stripControlChars(raw), usage };
}

// ── Tool-calling primitive (M3b Task 4) ──────────────────────────────────────
// A multi-turn, OpenAI-function-calling variant of chatCompletion. Where chatCompletion
// is a single user prompt → text, chatWithTools carries a full message history (including
// prior assistant tool calls and their tool results) and exposes any function the model
// wants to call, so a caller can run an agentic loop. Uses the same provider plumbing,
// tokensParam and reasoning-model temperature rule (this primitive never sends temperature).

// A single function call the model asked for. `arguments` is the raw JSON string the model
// emitted — parse it at the call site (it may be partial/invalid model output).
export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

// One turn of the conversation, in this app's own shape (serialised to the OpenAI wire
// format inside chatWithTools). A `tool` turn carries a function result keyed by
// `toolCallId`; an `assistant` turn that called functions carries `toolCalls`.
export interface ChatTurn {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

// A function the model may call, described by JSON Schema `parameters`.
export interface ChatToolSchema {
  name: string;
  description: string;
  parameters: object;
}

interface ChatWithToolsResponse {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

// Serialise one ChatTurn to the OpenAI chat message wire shape.
function toWireMessage(turn: ChatTurn): Record<string, unknown> {
  if (turn.role === 'tool') {
    return { role: 'tool', tool_call_id: turn.toolCallId, content: turn.content };
  }
  if (turn.role === 'assistant' && turn.toolCalls && turn.toolCalls.length > 0) {
    return {
      role: 'assistant',
      content: turn.content || null,
      tool_calls: turn.toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function',
        function: { name: tc.name, arguments: tc.arguments },
      })),
    };
  }
  return { role: turn.role, content: turn.content };
}

export async function chatWithTools(
  provider: ModelProvider,
  messages: ChatTurn[],
  tools: ChatToolSchema[],
  maxTokens: number
): Promise<{ content: string; toolCalls: ToolCall[]; usage: Usage | null }> {
  if (!provider.apiKey) {
    throw new Error('OPENAI_API_KEY is not configured. Add it to backend/.env.');
  }

  const body: Record<string, unknown> = {
    model: provider.model,
    messages: messages.map(toWireMessage),
    [provider.tokensParam]: maxTokens,
  };
  // Reasoning models reject `temperature`; this primitive never sends one regardless.
  if (tools.length > 0) {
    body.tools = tools.map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    body.tool_choice = 'auto';
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OPENAI_TIMEOUT_MS), // W-144: fail a hung call fast
  });

  if (!response.ok) {
    const errorText = (await response.text()).slice(0, 300);
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as ChatWithToolsResponse;
  const msg = data.choices?.[0]?.message;
  if (!msg) {
    throw new Error('OpenAI API returned no message');
  }
  const toolCalls: ToolCall[] = (msg.tool_calls || []).map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));
  const usage: Usage | null = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens || 0,
        completionTokens: data.usage.completion_tokens || 0,
        totalTokens: data.usage.total_tokens || 0,
      }
    : null;
  console.log('[ai-usage]', JSON.stringify({ role: 'chat', model: provider.model, ...(usage || { totalTokens: null }) }));
  return { content: msg.content || '', toolCalls, usage };
}

// Sum of many usages, for a per-worksheet total (W-23).
export interface UsageTotals {
  calls: number;
  totalTokens: number;
  byModel: Record<string, number>;
}
function accumulate(totals: UsageTotals, model: string, usage: Usage | null): void {
  totals.calls += 1;
  if (usage) {
    totals.totalTokens += usage.totalTokens;
    totals.byModel[model] = (totals.byModel[model] || 0) + usage.totalTokens;
  }
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
  // M3a Task 9: JSON string mapping writing-criteria slugs to 0-100 scores, or null when
  // the model's criteria object was missing/malformed. Stored on Analysis.criteriaScores.
  criteriaScores: string | null;
}

const ANALYSIS_SCORE_FIELDS = ['vocabScore', 'structureScore', 'contentScore', 'overallScore'] as const;
const ANALYSIS_TEXT_FIELDS = ['vocabComments', 'structureComments', 'contentComments', 'summary'] as const;

// M3a Task 9: per-criterion scores against the closed writing taxonomy. WRITING_SKILLS
// (prisma/seed-skills.ts) is the single source of truth for the 7 slugs — the prompt,
// the parser and the seeded Skill rows can never disagree.
const WRITING_CRITERIA_SLUGS = new Set(WRITING_SKILLS.map((s) => s.slug));

// Defensive by design — the opposite of the strict headline-score parse above. The
// criteria block is an additive enrichment: a missing or malformed "criteria" object
// (e.g. an older stubbed response, or a model that ignored the instruction) must degrade
// to null, never fail an otherwise-valid analysis. Unknown slugs and out-of-range or
// non-numeric values are dropped entry-by-entry; an empty survivor set is stored as null.
export function parseCriteriaScores(criteria: unknown): string | null {
  if (criteria == null || typeof criteria !== 'object' || Array.isArray(criteria)) return null;
  const out: Record<string, number> = {};
  for (const [slug, value] of Object.entries(criteria as Record<string, unknown>)) {
    if (!WRITING_CRITERIA_SLUGS.has(slug)) continue;
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0 || value > 100) continue;
    out[slug] = Math.round(value);
  }
  return Object.keys(out).length > 0 ? JSON.stringify(out) : null;
}

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
    criteriaScores: parseCriteriaScores(parsed.criteria),
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

In addition to the headline scores, score the piece 0-100 on each of these 7 marking criteria (use exactly these keys, all 7 of them, no others):
${WRITING_SKILLS.map((s) => `- ${s.slug}: ${s.name} — ${s.description}`).join('\n')}

Respond with ONLY a JSON object (no markdown, no code fences) in this exact format:
{
  "vocabScore": <0-100>,
  "vocabComments": "<specific feedback about vocabulary, referencing the student's actual word choices>",
  "structureScore": <0-100>,
  "structureComments": "<specific feedback about structure and flow, referencing the student's actual structure>",
  "contentScore": <0-100>,
  "contentComments": "<specific feedback about content and how well it follows the expected structure, referencing the student's actual content>",
  "overallScore": <0-100>,
  "summary": "<2-3 sentence summary of the overall performance>",
  "criteria": {${WRITING_SKILLS.map((s) => `"${s.slug}": <0-100>`).join(', ')}}
}

All comments must reference specific parts of the student's text.`;

  const { content } = await chatCompletion(providerFor('analysis'), prompt, 1500, 0.7);
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
        const { content } = await chatCompletion(providerFor('generation'), prompt, 2000, 0.8);
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
  skillSlug: string;
  stimulus?: StimulusSpec;
}

// Closed skill taxonomy (M3a Task 2): per-topic skill lists the generator must tag
// against. Static import — the seed and the prompt share one source of truth.
function skillsForTopic(topicSlug: string) {
  return MATH_SKILLS[topicSlug] ?? THINKING_SKILLS[topicSlug] ?? [];
}

// W-93: all topics in one worksheet must share a subject (math OR thinking-skills), so the
// generator can pick the right option count and figure vocabulary. Throws on a mixed selection.
export function subjectOfTopics(topics: { subject: string }[]): string {
  const subjects = new Set(topics.map((t) => t.subject));
  if (subjects.size > 1) throw new Error('Cannot mix subjects in one worksheet');
  return topics[0]?.subject ?? 'math';
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
async function solveIndependently(q: GeneratedMathQuestion): Promise<{ index: number; usage: Usage | null }> {
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
    const { content, usage } = await chatCompletion(providerFor('verification'), prompt, 4000);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { index: -1, usage };
    const verdict = JSON.parse(jsonMatch[0]);
    return { index: Number.isInteger(verdict.correctIndex) ? verdict.correctIndex : -1, usage };
  } catch (error) {
    console.error('Answer-key verification failed:', error);
    return { index: -1, usage: null };
  }
}

// Escalating-hybrid audit (W-20): a stronger, independent model solves the question. If its
// first solve agrees with the claimed key, accept (one call — the common case). Otherwise
// escalate to two more independent solves and keep only if the key wins a clear majority
// with no "none" verdict. Catches keys the generator got wrong (its correlated verifier
// used to just confirm them).
async function verifyQuestionKey(q: GeneratedMathQuestion, totals: UsageTotals): Promise<boolean> {
  const vModel = providerFor('verification').model;
  const first = await solveIndependently(q);
  accumulate(totals, vModel, first.usage);
  if (first.index === q.correctIndex) return true;
  const [second, third] = await Promise.all([solveIndependently(q), solveIndependently(q)]);
  accumulate(totals, vModel, second.usage);
  accumulate(totals, vModel, third.usage);
  return keptByEscalation([first.index, second.index, third.index], q.correctIndex);
}

// Skill-tag audit (M3a Task 8): one verifier-role call per question, after its answer key
// is confirmed. The verifier picks the best-fitting slug from the topic's closed list; on
// disagreement its choice wins (logged). Best-effort — any failure keeps the generator's
// tag, which already passed the closed-list check.
async function verifySkillTag(q: GeneratedMathQuestion, totals: UsageTotals): Promise<string> {
  const skills = skillsForTopic(q.topicSlug);
  if (skills.length === 0) return q.skillSlug;
  const prompt = `You are auditing the skill tag of a multiple-choice question from the topic "${q.topicName}".

Question:
${q.questionText}

Explanation of the intended solution:
${q.explanation}

The topic's closed skill list (slug: name):
${skills.map((s) => `- ${s.slug}: ${s.name}`).join('\n')}

Which single skill slug from the list fits this question best? Respond with ONLY a JSON object (no markdown, no code fences):
{"skillSlug": "<one slug from the list>"}`;

  try {
    const provider = providerFor('verification');
    const { content, usage } = await chatCompletion(provider, prompt, 2000);
    accumulate(totals, provider.model, usage);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return q.skillSlug;
    const verdict = JSON.parse(jsonMatch[0]);
    const chosen = verdict?.skillSlug;
    if (typeof chosen !== 'string' || !skills.some((s) => s.slug === chosen)) return q.skillSlug;
    if (chosen !== q.skillSlug) {
      console.log('[skill-tag]', JSON.stringify({
        question: q.questionText.slice(0, 80), generator: q.skillSlug, verifier: chosen,
      }));
    }
    return chosen;
  } catch (error) {
    console.error('Skill-tag verification failed:', error);
    return q.skillSlug;
  }
}

export function isValidGeneratedQuestion(q: any, allowedSlugs: Set<string>, optionCount = 5): boolean {
  const structurallyValid =
    q &&
    typeof q.questionText === 'string' &&
    q.questionText.length > 0 &&
    Array.isArray(q.options) &&
    q.options.length === optionCount &&
    q.options.every((o: unknown) => typeof o === 'string' || typeof o === 'number') &&
    Number.isInteger(q.correctIndex) &&
    q.correctIndex >= 0 &&
    q.correctIndex < optionCount &&
    typeof q.explanation === 'string' &&
    typeof q.topicSlug === 'string' &&
    allowedSlugs.has(q.topicSlug) &&
    // Skill tag (M3a Task 8): every question must be tagged from its own topic's
    // closed skill list.
    typeof q.skillSlug === 'string' &&
    skillsForTopic(q.topicSlug).some((s) => s.slug === q.skillSlug);
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

// W-87: strict de-duplication of generated questions — no exact/normalized repeats, and no
// re-skinned direction/turn questions that resolve to the same rotation from the same start.
export function normalizeQuestionText(text: string): string {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

const MAX_AVOID_IN_PROMPT = 40;
export function buildUniquenessInstructions(avoidTexts: string[]): string {
  const lines = [
    'UNIQUENESS — STRICT. Every question must be genuinely different from every other question in',
    'this worksheet AND from previous worksheets. Two questions are duplicates if they reduce to the',
    'same problem even when the wording, names, or objects differ.',
    '- Direction / turning questions: never reuse the same STARTING compass direction together with the',
    '  same sequence and counts of turns (half turns, quarter turns, or degrees). For each such question',
    '  change BOTH the starting direction and the turns/degrees so that no two resolve to the same rotation.',
    '- Do not rephrase, re-skin, renumber, or make a trivial variation of any earlier question.',
  ];
  const avoid = avoidTexts.filter((t) => t && t.trim()).slice(-MAX_AVOID_IN_PROMPT);
  if (avoid.length > 0) {
    lines.push('');
    lines.push('DO NOT produce any question equivalent to these already-used questions:');
    for (const t of avoid) lines.push(`- ${t.slice(0, 200)}`);
  }
  return lines.join('\n');
}

export interface GenerationOpts {
  optionCount?: number; // 5 for math (default), 4 for thinking-skills
  subject?: string;     // 'math' (default) | 'thinking-skills' — selects the figure vocabulary
  briefVariant?: 'on' | 'off'; // W-141 A/B: 'on' splices topic briefs in; 'off' = baseline prompt
}

const OPTION_WORD: Record<number, string> = { 3: 'three', 4: 'four', 5: 'five' };

// W-141 A/B toggle for the topic-brief injection. Default 'on'; set MATH_TOPIC_BRIEFS=off (or 0 /
// false) to revert to the pre-brief baseline prompt with zero code changes. Read once at load.
const DEFAULT_BRIEF_VARIANT: 'on' | 'off' =
  /^(off|0|false)$/i.test(process.env.MATH_TOPIC_BRIEFS ?? '') ? 'off' : 'on';

// W-93: the batch prompt, subject-parametrized. For subject 'math' (the default) it is unchanged
// from before: five-option, four distractors, a 5-option example, and the base figure vocabulary.
// Exported so the parametrization is unit-testable without calling the model.
export function buildGenerationBatchPrompt(
  topics: MathTopicForGen[],
  count: number,
  avoidTexts: string[] = [],
  opts: GenerationOpts = {},
): string {
  const optionCount = opts.optionCount ?? 5;
  const subject = opts.subject ?? 'math';
  const optionWord = OPTION_WORD[optionCount] ?? `${optionCount}`;
  const distractorWord = OPTION_WORD[optionCount - 1] ?? `${optionCount - 1}`;
  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, optionCount);
  const optionsExample = `[${optionLabels.map((l) => `"${l}"`).join(', ')}]`;
  // Thinking-skills-only figures appended after the base vocabulary; empty string for math (so the
  // math prompt is unchanged).
  const extraFigures = subject === 'thinking-skills'
    ? '\n- {"kind":"target","rings":[1,3,6,10],"darts":[0,1,2]} — concentric rings; values outermost→bullseye; darts are the ring indices hit (score = sum)\n- {"kind":"fold-cut","foldCount":2,"cut":"centre","cutShape":"circle"} — paper folded foldCount times then a single cut (holes when unfolded = 2^foldCount)'
    : '';

  const exemplars = topics.map(t => {
    const hardest = t.questions[0];
    if (!hardest) return null;
    return { topic: t.name, percentCorrect: hardest.percentCorrect, question: hardest.questionText };
  }).filter(Boolean);

  const briefVariant = opts.briefVariant ?? DEFAULT_BRIEF_VARIANT;
  // '' when variant is 'off' OR no selected topic is briefed → prompt stays byte-for-byte baseline.
  const briefSection = briefVariant === 'on' ? buildTopicBriefSection(topics.map((t) => t.slug)) : '';

  return `You are a mathematics tutor creating a practice worksheet for a student preparing for the NSW Selective High School Placement Test (Mathematical Reasoning section).

The worksheet should cover the following topic(s):
${topics.map(t => `- ${t.name} (slug: ${t.slug}): ${t.description}`).join('\n')}

Generate exactly ${count} ${optionWord}-option multiple-choice questions distributed across these topics. Each question must have exactly one correct answer and ${distractorWord} plausible distractors.

SKILL TAGGING. Each topic has a closed list of skills. Every question must carry a "skillSlug" naming the single skill it most directly tests, chosen from ITS OWN topic's list below — never a slug from another topic, never a made-up slug:
${topics.map(t => `- ${t.name} (${t.slug}):\n${skillsForTopic(t.slug).map(s => `  - ${s.slug}: ${s.name}`).join('\n')}`).join('\n')}

DIFFICULTY REQUIREMENT: Each question must be at or above the difficulty of the hardest known reference question for its topic. Here are the hardest reference questions per topic (with their cohort % Correct — lower % = harder):

${exemplars.map(e => `- ${e!.topic}: ${e!.percentCorrect}% correct (hard). Example: "${e!.question}"`).join('\n')}

${buildUniquenessInstructions(avoidTexts)}

For each question, provide a detailed "Question Feedback" style explanation.

READING LEVEL. Write every explanation for a Year 6 student sitting the NSW Selective test.
Use only methods a strong Year 6 student knows — arithmetic, simple fractions and decimals,
diagrams, patterns, and step-by-step logical reasoning. Do NOT use higher-level or
secondary-school tools to explain a primary-level problem (no formal algebra with variables
like x/y, no simultaneous equations, no exponents/roots beyond squares, no trigonometry),
even when they would be shorter. Keep the language plain and the steps small.

INTUITIVE METHOD & CLEAN NUMBERS. Explain each answer using the same intuitive speed-tricks a good
tutor teaches — not a calculator dump:
- Reach for a concrete mental model: "Building Blocks" (find the smallest CLEAN stepping-stone that
  keeps whole numbers, then scale up), friendly benchmarks (10%, 25%, 50%, doubling/halving), the
  clock-face for time and angles (60 min = 1 whole, so 50 min = 5/6 h; 90° = 1/4 turn), bar models,
  estimation, and eliminating impossible options.
- PREFER clean fractions and multipliers over unwieldy or repeating decimals. Keep EVERY intermediate
  value clean: write "50 min = 5/6 h", keep a total as "17/6 h", and finish "130 × 6/17 ≈ 45.88 km/h"
  — never a running "0.8333…" decimal division, and never long decimal division shown step by step.
- Only turn the final answer into a decimal at the very END, and only if the question asks for one,
  rounded to exactly the places requested.
Aim for an explanation a Year 6 student could redo in their head, the way the coaching lessons teach.

VISUAL STIMULI. A question may include an optional "stimulus" field carrying structured
figure data that the app renders as a real image (charts via a chart library, geometry via
SVG). Use one when the topic naturally needs a visual (protractor readings, graphs, grids,
shapes). Format: {"version":1,"text":"<lead-in sentence>","figures":[<figure>]} where a
figure is ONE of:
- {"kind":"protractor","rays":[20,50],"joinPairs":[[20,50]]} — rays at degree marks 0-180
- {"kind":"line-chart","title":"...","xLabel":"...","yLabel":"...","points":[{"x":"9 am","y":0},...]} (same shape for "bar-chart")
- {"kind":"pie-chart","sectors":[{"label":"Rent","percent":25,"showPercent":false},...]} — percents must sum to 100
- {"kind":"table","columns":["Size","Price"],"rows":[["Small",6],...]}
- {"kind":"grid","rows":4,"cols":6,"filled":[[0,2],[1,1]],"rowLabels":["1","2","3","4"],"colLabels":["A","B","C","D","E","F"]}
- {"kind":"compass","facing":"N"}
- {"kind":"shape","unit":"cm","vertices":[[0,0],[12,0],[12,12],[0,12]],"sideLabels":[{"side":0,"label":"12 cm"}]}
- {"kind":"rotation","shape":"arrow","beforeDeg":0,"afterDeg":225}
- {"kind":"cards","values":["4/5","0.15","1/3"]}${extraFigures}

${briefSection ? briefSection + '\n\n' : ''}READABLE SLICES & ANGLES. When a pie-chart, protractor or rotation asks the student to READ or
ESTIMATE a slice or angle FROM the figure (an unlabelled slice, "what fraction is shaded?", "estimate
this angle", "which slice is biggest?"), that amount MUST be an intuitive one with a mental shortcut:
halves (50% = 180°), quarters (25% = 90°), eighths (12.5% = 45°) and their multiples or sums, or
clock-face angles (multiples of 30° / 90°). Build the WHOLE pie from these clean fractions so the
computed answer is intuitive too. NEVER make the student decipher an awkward slice or angle that has
no mental shortcut (16%, 27%, 33%, 40%, 72° …). A slice printed with "showPercent":true may carry a
clean labelled value, since the student reads the number rather than judging the angle by eye.

READABLE PLOTTED VALUES (bar & line graphs). Every data value the student must READ off a bar or
line graph must sit where they can pinpoint it by intuitive calculation from the axis — either ON a
gridline, or at an OBVIOUS clean fraction of the gridline spacing (exactly halfway, or a quarter or
three-quarters of the way, between two gridlines) that lands on a clean number. Choose the gridline
spacing to make each read value fall on such a spot: spacing 5 lets you use 7.5 (the clear midpoint
of 5 and 10); spacing 0.5 puts 7.5 right on a line. NEVER require reading a value that sits at an
awkward position with no obvious fraction of the spacing — with gridlines 8 apart (0, 8, 16, 24) the
values 7.5 and 22.5 are unreadable, because neither is a gridline nor a clean half/quarter step of 8.
Gridline spacing must still not be 1 (per the FIGURES rule when present), so the student still works
out the scale. Also keep the answer clean: for a mean or total, make the read values sum to a clean
multiple.

PIE LABELS — LEAVE ROOM TO INFER. Do NOT label every slice with its percentage. On many pie
questions, deliberately leave ONE (or more) slices UNLABELLED (set "showPercent":false on them) so
the student must INFER that value — but only by a clean, intuitive calculation, never by judging the
slice's angle by eye. Make the inference clean: the unlabelled slice is the remainder (100 minus the
labelled clean slices), or it is an obvious clean fraction of the whole (a quarter, a half, an
eighth). Keep enough slices labelled ("showPercent":true) that the inference is a simple mental
subtraction or fraction, not a guess — a value the student must READ to plug into later arithmetic
stays labelled; a value the student should DERIVE is left unlabelled. Inferring the unlabelled slice
must NEVER be the whole question (that is just a one-step read, e.g. "the other slices are 40% and
25%, what is the third?"). The derived share must then FEED a further step — apply it to a total, or
compare it against another category as a quantity — so the question stays multi-step per below.

MULTI-STEP DATA INTERPRETATION. Clean angles and numbers are for READABILITY — never an excuse to
make a chart question easy. Every data-interpretation question (pie, bar, line, table) must be a
genuine multi-step NSW-Selective problem, not a one-step read. Do NOT ask "what percent is the biggest
slice?" or "the other slices are 40% and 25%, what is the third?". Instead demand reasoning that
combines the figure with a total or across categories: apply a share to a whole ("360 people; the 25%
slice is how many?"), REVERSE it ("the 90° slice is 60 people — how many in total?"), compare or
difference two categories AS QUANTITIES, or CHAIN steps (find the missing share, THEN apply it to the
total, THEN compare). Keep every number clean so the arithmetic stays mental, but the REASONING must
be exam-level and multi-step.

COMPASS & DIRECTION CONVENTION. On any grid, map, or figure, NORTH is toward the TOP of the figure
(up on the screen), SOUTH the bottom, EAST the right, WEST the left. A grid renders its row labels
from top to bottom exactly as listed, so the row shown at the TOP is the northernmost. When a
question maps grid/map positions to a compass direction:
- State the orientation explicitly in the questionText, e.g. "North is toward the top of the grid".
- Describe the rows the way the figure shows them (top row first). NEVER write "bottom to top" or any
  row ordering that contradicts the figure.
- Work out the answer from visual position (up = North, down = South), not from row-number arithmetic.
- Only ask for a "single compass direction" when the move is exactly North/South/East/West, or an
  exact diagonal (the same number of steps horizontally and vertically).

HARD RULE: every question must be fully answerable from its questionText plus its own
stimulus. NEVER write "shown below", "in the diagram", "on the protractor" or similar
unless the question includes a stimulus containing that exact figure and all data needed
to solve it. Questions violating this are discarded.

Respond with ONLY a JSON array (no markdown, no code fences) in this exact format:
[
  {
    "questionText": "full question text including any tables or data",
    "options": ${optionsExample},
    "correctIndex": 0,
    "explanation": "Step-by-step reasoning. Therefore, the answer is Option X.",
    "topicSlug": "<slug of this question's topic, one of: ${topics.map(t => t.slug).join(', ')}>",
    "topicName": "<name of this question's topic>",
    "skillSlug": "<slug of the single skill this question most tests, from its topic's skill list above>",
    "stimulus": <optional, as described above>
  }
]

Generate exactly ${count} questions. Make sure distractors are plausible — they should be answers a student might get from common mistakes.`;
}

// W-143: gpt-5-mini is a reasoning model — hidden reasoning tokens are drawn from the SAME
// max_completion_tokens budget as the visible JSON. A budget sized only for the JSON (the old
// count*600+4000) is fully consumed by reasoning on the heavier briefed prompts, so the model
// returns EMPTY content (finish_reason=length) and the batch retry-storms — the ~15-minute stall.
// Measured headroom: a 10-question briefed batch spends ~12.4k completion tokens, so give ~18k.
export function generationTokenBudget(count: number): number {
  return Math.min(count * 1200 + 6000, 24000);
}

async function generateQuestionBatch(
  topics: MathTopicForGen[],
  count: number,
  avoidTexts: string[] = [],
  opts: GenerationOpts = {},
): Promise<{ questions: any[]; usage: Usage | null }> {
  const prompt = buildGenerationBatchPrompt(topics, count, avoidTexts, opts);
  // Reasoning models think inside the completion budget, so leave generous headroom (W-143).
  const { content, usage } = await chatCompletion(providerFor('generation'), prompt, generationTokenBudget(count), 0.8);
  const arrayMatch = content.match(/\[[\s\S]*\]/);
  if (!arrayMatch) {
    throw new Error('Generation response did not contain a JSON array');
  }
  const parsed = JSON.parse(arrayMatch[0]);
  if (!Array.isArray(parsed)) {
    throw new Error('Generation response was not an array');
  }
  return { questions: parsed, usage };
}

// Resolve the topic rows generation runs over, each with its hardest known question for
// difficulty calibration (W-19). Shared by the POST /generate route and the M3b chat
// action executor. `topicSlugs` empty/omitted → every topic.
// When explicit slugs are given they resolve regardless of subject (subject is derived from them);
// when none are given ("all topics") it defaults to a single subject — 'math' — so an all-topics
// math worksheet never pulls in thinking-skills topics (W-93 no-regression).
export async function resolveMathTopicsForGeneration(topicSlugs?: string[], subject = 'math') {
  const where = topicSlugs && topicSlugs.length > 0 ? { slug: { in: topicSlugs } } : { subject };
  return prisma.mathTopic.findMany({
    where,
    include: {
      questions: {
        orderBy: { percentCorrect: 'asc' },
        take: 1, // hardest question per topic for difficulty calibration
      },
    },
  });
}

export async function generateMathWorksheetQuestions(
  topics: MathTopicForGen[],
  questionCount = 35,
  avoidTexts: string[] = [],
  opts: GenerationOpts = {}
): Promise<GeneratedMathQuestion[]> {
  const optionCount = opts.optionCount ?? 5;
  const allowedSlugs = new Set(topics.map(t => t.slug));
  const nameBySlug = new Map(topics.map(t => [t.slug, t.name]));
  const collected: GeneratedMathQuestion[] = [];
  const totals: UsageTotals = { calls: 0, totalTokens: 0, byModel: {} };
  const genModel = providerFor('generation').model;
  // W-87: strict de-dup. `seen` holds normalized text of previous-worksheet questions AND everything
  // collected this run; `promptAvoid` is fed to each batch so the model avoids re-skinning them.
  const seen = new Set(avoidTexts.map(normalizeQuestionText));
  const promptAvoid: string[] = [...avoidTexts];

  // Verification drops some candidates, so allow extra top-up calls.
  const maxCalls = Math.ceil(questionCount / GENERATION_BATCH_SIZE) + 5;
  let failedCalls = 0;

  for (let call = 0; call < maxCalls && collected.length < questionCount; call++) {
    const need = Math.min(GENERATION_BATCH_SIZE, questionCount - collected.length);
    try {
      const batchResult = await generateQuestionBatch(topics, need, promptAvoid, opts);
      accumulate(totals, genModel, batchResult.usage);
      const candidates: GeneratedMathQuestion[] = batchResult.questions
        .filter(q => isValidGeneratedQuestion(q, allowedSlugs, optionCount) && hasDistinctOptions(q.options.map(String)))
        .map(q => ({
          questionText: q.questionText,
          options: q.options.map(String),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          topicSlug: q.topicSlug,
          topicName: nameBySlug.get(q.topicSlug)!,
          skillSlug: q.skillSlug,
          ...(q.stimulus !== undefined ? { stimulus: q.stimulus } : {}),
        }))
        // W-88: discard grid→compass questions whose answer key disagrees with the geometry of the
        // rendered grid (North = top), or whose move isn't a single well-defined direction.
        .filter((c) => checkGridCompassDirection(c) !== 'wrong');

      // W-87: drop any exact/normalized duplicate (of a prior worksheet or of anything already
      // collected this run) BEFORE spending verifier calls on it.
      const fresh = candidates.filter((c) => {
        const n = normalizeQuestionText(c.questionText);
        if (seen.has(n)) return false;
        seen.add(n);
        return true;
      });

      // Audit every candidate's answer key in parallel; keep only confirmed ones.
      const verdicts = await Promise.all(fresh.map((c) => verifyQuestionKey(c, totals)));
      const verified = fresh
        .filter((_, i) => verdicts[i])
        .slice(0, questionCount - collected.length);
      // Skill-tag audit (M3a Task 8): one verifier call per surviving question; the
      // verifier's choice wins on disagreement.
      await Promise.all(verified.map(async (q) => {
        q.skillSlug = await verifySkillTag(q, totals);
      }));
      collected.push(...verified);
      // Feed the kept questions back so later batches avoid re-skinning them.
      promptAvoid.push(...verified.map((q) => q.questionText));
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
  // Per-worksheet token/cost total (W-23).
  console.log('[worksheet-usage]', JSON.stringify({
    questions: collected.length, calls: totals.calls, totalTokens: totals.totalTokens, byModel: totals.byModel,
  }));
  return collected;
}

// W-86: THE single source of truth for generating a math worksheet — used by BOTH the Admin UI
// generate route (POST /api/math/worksheets/generate, inside its job) and the coach-chat
// generate_worksheet action, so the two paths can never diverge. Clamps the count (5–50), resolves
// the topics, and generates the questions. Returns the topic summaries + a default title.
export async function generateMathWorksheet(
  topicSlugs: string[] | undefined,
  rawQuestionCount: unknown,
  workspaceId: number,
): Promise<{ title: string; topics: { id: number; name: string; slug: string }[]; questions: GeneratedMathQuestion[] }> {
  const questionCount = Math.max(5, Math.min(50, parseInt(String(rawQuestionCount), 10) || 35));
  const topics = await resolveMathTopicsForGeneration(topicSlugs);
  if (topics.length === 0) {
    throw new Error('No topics found for the requested selection');
  }
  // W-93: derive the subject from the resolved topics (mixed → error) and pick the option count.
  const subject = subjectOfTopics(topics);
  const optionCount = subject === 'thinking-skills' ? 4 : 5;
  // W-87: no repeats from previous worksheets — feed this workspace's saved questions to the
  // generator so it avoids reproducing (or re-skinning) any of them.
  const previous = await prisma.mathQuestion.findMany({
    where: { worksheet: { workspaceId } },
    select: { questionText: true },
    orderBy: { id: 'desc' },
    take: 500,
  });
  const avoidTexts = previous.map((p) => p.questionText);
  const questions = await generateMathWorksheetQuestions(topics, questionCount, avoidTexts, { optionCount, subject });
  // W-104: the model favours putting the correct answer first — spread the correct-answer positions
  // evenly so a worksheet shows no discernible A,A,A… pattern.
  balanceAnswerPositions(questions, optionCount);
  const topicSummaries = topics.map((t) => ({ id: t.id, name: t.name, slug: t.slug }));
  const title = `${topics.map((t) => t.name).join(', ')} practice`;
  return { title, topics: topicSummaries, questions };
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
      // Placeholders still need a valid tag so the save path accepts them.
      skillSlug: skillsForTopic(t.slug)[0]?.slug ?? '',
    });
  }

  return fallback;
}
