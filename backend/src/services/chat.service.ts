// The admin coach chat tool loop (Milestone 3b Task 7). Runs a grounded, tool-calling
// conversation over the deterministic analytics service: read tools auto-execute and feed back
// into the loop; action tools (generate/save worksheet, create intervention) are NOT executed
// inline — they are parked as pending actions and returned for the admin to confirm.
//
// Transcript-validity invariant: the OpenAI API requires every assistant `tool_calls` turn to
// be followed by a `tool` message answering each tool_call_id. We uphold this by ALWAYS
// persisting a tool result for every tool call in the same step — a real result for read tools,
// and a `{status:'pending_confirmation'}` placeholder for the gated action tool (and a
// `skipped` placeholder for any extra action calls in the same turn) — so a rebuilt transcript
// is never left with a dangling tool call between a runChatStep and its confirm.
import prisma from '../lib/prisma';
import type { ChatMessage } from '@prisma/client';
import { chatWithTools, providerFor, ChatTurn, ToolCall } from './ai.service';
import {
  READ_TOOL_SCHEMAS,
  ACTION_TOOL_SCHEMAS,
  isActionTool,
  dispatchReadTool,
  executeActionTool,
  ToolContext,
} from './chat-tools';
import {
  createPendingAction,
  getPendingAction,
  deletePendingAction,
} from '../lib/pending-actions';

const MAX_ITERATIONS = 8;
const MAX_TOKENS = 1500;
const ALL_TOOLS = [...READ_TOOL_SCHEMAS, ...ACTION_TOOL_SCHEMAS];
const EXHAUSTED_REPLY =
  "I wasn't able to finish that within a reasonable number of steps. Could you narrow the question or ask about one thing at a time?";

const SYSTEM_PROMPT = `You are a coaching assistant for a teacher/admin using the NSW Selective Prep Coach.
You help them understand a student's performance and plan targeted practice.

Hard rules:
- NEVER state a numeric statistic (accuracy, time, counts, trends) that is not present in a tool
  result. You have no other source of numbers — if you have not fetched it via a tool, do not
  cite it. Call a tool instead.
- When the admin names or asks about a student, call get_student_skill_report FIRST (choose the
  subject they mean; default to math) before answering anything about that student.
- Respect the evidence gate: if a skill's report says sufficientEvidence is false, say there is
  not enough data yet to judge it — never call it a weakness or a strength from thin data.
- When proposing a worksheet as an intervention, make sure at least 8 questions target each skill
  you want to be able to measure, and say so to the admin.
- Actions (generating/saving worksheets, creating interventions) require the admin's confirmation;
  propose them clearly and let the confirmation happen — do not claim an action is done until you
  are told it was. Propose ONE action at a time.
- Be concise and specific. Prefer the student's actual skill names and the numbers the tools return.`;

// A stored assistant tool-call turn is JSON with this discriminant; plain assistant text is
// stored raw (and will not parse to an object carrying this key).
interface StoredToolCallTurn {
  __assistantToolCalls: ToolCall[];
}
interface StoredToolResult {
  toolName: string;
  args: unknown;
  result: unknown;
  toolCallId: string;
}

async function loadSession(sessionId: number, ctx: ToolContext) {
  const session = await prisma.chatSession.findUnique({ where: { id: sessionId } });
  if (!session || session.workspaceId !== ctx.workspaceId) {
    throw new Error('Chat session not found');
  }
  return session;
}

function sessionMessages(sessionId: number): Promise<ChatMessage[]> {
  return prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { id: 'asc' } });
}

// Rebuild the OpenAI-shaped transcript from persisted rows, prefixed with the system prompt.
function buildTranscript(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [{ role: 'system', content: SYSTEM_PROMPT }];
  for (const m of messages) {
    if (m.role === 'user') {
      turns.push({ role: 'user', content: m.content });
    } else if (m.role === 'assistant') {
      const parsed = tryParse<StoredToolCallTurn>(m.content);
      if (parsed && Array.isArray(parsed.__assistantToolCalls)) {
        turns.push({ role: 'assistant', content: '', toolCalls: parsed.__assistantToolCalls });
      } else {
        turns.push({ role: 'assistant', content: m.content });
      }
    } else if (m.role === 'tool') {
      const parsed = tryParse<StoredToolResult>(m.content);
      turns.push({
        role: 'tool',
        content: JSON.stringify(parsed ? parsed.result : m.content),
        toolCallId: parsed?.toolCallId,
      });
    }
  }
  return turns;
}

function tryParse<T>(raw: string): T | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? (v as T) : null;
  } catch {
    return null;
  }
}

function parseArgs(raw: string): any {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return {};
  }
}

async function persist(sessionId: number, role: string, content: string) {
  await prisma.chatMessage.create({ data: { sessionId, role, content } });
}

async function persistToolResult(sessionId: number, tc: ToolCall, result: unknown) {
  const stored: StoredToolResult = { toolName: tc.name, args: parseArgs(tc.arguments), result, toolCallId: tc.id };
  await persist(sessionId, 'tool', JSON.stringify(stored));
}

export interface ChatStepResult {
  messages: ChatMessage[];
  suggestedQuestions: string[];
  pendingAction?: { id: string; toolName: string; args: any };
}

// The single tool loop shared by runChatStep and resolvePendingAction. Repeatedly asks the
// model, auto-executing read tools and feeding results back, until it returns a plain answer
// (persisted) or asks for a gated action (parked + returned). Every tool call in a turn is
// answered in the same iteration, so the transcript is always a valid OpenAI sequence. Returns
// the pending action to confirm, if any.
async function driveLoop(sessionId: number, ctx: ToolContext): Promise<ChatStepResult['pendingAction']> {
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const messages = await sessionMessages(sessionId);
    const { content, toolCalls } = await chatWithTools(providerFor('chat'), buildTranscript(messages), ALL_TOOLS, MAX_TOKENS);

    if (toolCalls.length === 0) {
      await persist(sessionId, 'assistant', content);
      return undefined;
    }

    await persist(sessionId, 'assistant', JSON.stringify({ __assistantToolCalls: toolCalls }));

    let pendingAction: ChatStepResult['pendingAction'];
    for (const tc of toolCalls) {
      if (isActionTool(tc.name)) {
        if (!pendingAction) {
          const action = createPendingAction(ctx.workspaceId, tc.name, parseArgs(tc.arguments));
          await persistToolResult(sessionId, tc, { status: 'pending_confirmation', pendingActionId: action.id });
          pendingAction = { id: action.id, toolName: action.toolName, args: action.args };
        } else {
          // Only one action is gated per turn; answer extra action calls benignly so the
          // transcript stays valid and no orphaned pending action is created.
          await persistToolResult(sessionId, tc, {
            status: 'skipped',
            reason: 'Only one action is processed at a time; confirm the first, then propose the next.',
          });
        }
      } else {
        await persistToolResult(sessionId, tc, await safeDispatch(tc, ctx));
      }
    }
    if (pendingAction) return pendingAction; // wait for the admin to confirm before continuing
  }

  // Ran the iteration budget without a plain answer or a gate: give the admin something back.
  await persist(sessionId, 'assistant', EXHAUSTED_REPLY);
  return undefined;
}

// Run one user turn: persist it, then drive the loop.
export async function runChatStep(sessionId: number, userText: string, ctx: ToolContext): Promise<ChatStepResult> {
  await loadSession(sessionId, ctx);
  await persist(sessionId, 'user', userText);
  const pendingAction = await driveLoop(sessionId, ctx);
  const messages = await sessionMessages(sessionId);
  return { messages, suggestedQuestions: deriveSuggestedQuestions(messages), pendingAction };
}

// Confirm or discard a parked action. On approve we execute it; either way we inject the outcome
// as a synthetic context turn and drive the same loop so the model narrates (and any follow-up
// action it proposes is gated again, uniformly).
export async function resolvePendingAction(
  sessionId: number,
  actionId: string,
  approve: boolean,
  ctx: ToolContext,
): Promise<ChatStepResult> {
  await loadSession(sessionId, ctx);
  const action = getPendingAction(actionId, ctx.workspaceId);
  if (!action) throw new Error('Pending action not found');

  if (approve) {
    let outcome: string;
    try {
      const result = await executeActionTool(action.toolName, action.args, ctx);
      outcome = `(system) The admin approved the "${action.toolName}" action. It completed. Result: ${JSON.stringify(result)}`;
    } catch (e: any) {
      outcome = `(system) The admin approved the "${action.toolName}" action but it failed: ${e?.message || 'unknown error'}.`;
    }
    deletePendingAction(actionId);
    await persist(sessionId, 'user', outcome);
  } else {
    deletePendingAction(actionId);
    await persist(sessionId, 'user', `(system) The admin declined the "${action.toolName}" action. No change was made.`);
  }

  const pendingAction = await driveLoop(sessionId, ctx);
  const messages = await sessionMessages(sessionId);
  return { messages, suggestedQuestions: deriveSuggestedQuestions(messages), pendingAction };
}

async function safeDispatch(tc: ToolCall, ctx: ToolContext): Promise<unknown> {
  try {
    return await dispatchReadTool(tc.name, parseArgs(tc.arguments), ctx);
  } catch (e: any) {
    return { error: e?.message || 'tool failed' };
  }
}

// Generic follow-ups used to pad the grounded chips to 3-5 when the report is thin.
const GENERIC_SUGGESTIONS = [
  'Draft a targeted practice plan for the weakest areas.',
  'Has this student had an intervention before, and did it help?',
  'Which skills have the least data so far?',
  'How does this student compare on timing versus accuracy?',
];

// Grounded follow-up chips: derived deterministically from the most recent
// get_student_skill_report result in the transcript (no model call). Empty if none was fetched;
// otherwise always 3-5 (skill-specific first, padded with generics).
function deriveSuggestedQuestions(messages: ChatMessage[]): string[] {
  let report: any = null;
  for (const m of messages) {
    if (m.role !== 'tool') continue;
    const parsed = tryParse<StoredToolResult>(m.content);
    if (parsed?.toolName === 'get_student_skill_report' && parsed.result && (parsed.result as any).skills) {
      report = parsed.result; // keep the latest
    }
  }
  if (!report) return [];

  const skills: any[] = Array.isArray(report.skills) ? report.skills : [];
  const named = (s: any) => s?.name || s?.slug;
  const out: string[] = [];

  const weakest = skills
    .filter((s) => s.sufficientEvidence)
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1))
    .slice(0, 2);
  for (const s of weakest) out.push(`What's driving the low accuracy in ${named(s)}?`);

  const slow = skills.find((s) => (s.slowWrong ?? 0) > 0);
  if (slow) out.push(`Is ${named(slow)} a speed problem or a skill gap?`);

  for (const g of GENERIC_SUGGESTIONS) {
    if (out.length >= 5) break;
    out.push(g);
  }
  return out.slice(0, 5);
}
