import type { ChatMessage } from '@/lib/api';
import { SkillReportCard } from './SkillReportCard';

// Renders a persisted coach-chat transcript. The stored messages carry plumbing the UI must
// interpret (see the M3b-1 message shapes):
//  - assistant turns whose content is {"__assistantToolCalls":[…]} are the model's tool requests
//    — hidden (the tool RESULTS are what's worth showing).
//  - tool messages carry {toolName, args, result}; an analytics result renders as a data card,
//    other tools as a compact "looked up …" note.
//  - user messages beginning "(system)" are action-outcome context turns — shown as a muted
//    status line, not as if the human typed them.

function tryParseObject(raw: string): any | null {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

export function ChatTranscript({ messages }: { messages: ChatMessage[] }) {
  return (
    <div className="flex flex-col gap-4">
      {messages.map((m) => {
        if (m.role === 'user') {
          if (m.content.startsWith('(system)')) {
            return (
              <div key={m.id} data-role="status" className="self-center text-xs text-gray-400">
                {m.content.replace(/^\(system\)\s*/, '')}
              </div>
            );
          }
          return (
            <div key={m.id} data-role="user" className="flex justify-end">
              <div className="max-w-[38rem] rounded-xl rounded-tr-sm bg-brand-blue text-white px-3.5 py-2.5 text-sm">
                {m.content}
              </div>
            </div>
          );
        }

        if (m.role === 'assistant') {
          const parsed = tryParseObject(m.content);
          if (parsed && Array.isArray(parsed.__assistantToolCalls)) {
            return null; // plumbing — the tool results are rendered separately
          }
          return (
            <div key={m.id} data-role="assistant" className="flex gap-2.5">
              <div className="w-7 h-7 shrink-0 rounded-lg bg-[#102a4a] text-white grid place-items-center text-xs font-bold">✦</div>
              <div className="max-w-[38rem] rounded-xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm whitespace-pre-wrap">
                {m.content}
              </div>
            </div>
          );
        }

        // tool result
        const parsed = tryParseObject(m.content);
        const result = parsed?.result;
        if (parsed?.toolName === 'get_student_skill_report' && result) {
          return (
            <div key={m.id} data-role="tool" className="flex gap-2.5">
              <div className="w-7 h-7 shrink-0 rounded-lg bg-[#102a4a] text-white grid place-items-center text-xs font-bold">✦</div>
              <SkillReportCard report={result} />
            </div>
          );
        }
        // Other tool results (action placeholders like create_intervention's pending/skipped,
        // or reads without a dedicated card) carry no admin-facing value here — the confirmation
        // card and the (system) outcome line already tell that story. Hide them.
        return null;
      })}
    </div>
  );
}
