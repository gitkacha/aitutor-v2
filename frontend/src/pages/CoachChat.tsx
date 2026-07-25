import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { chatApi, ChatMessage, PendingAction } from '@/lib/api';
import { ChatTranscript } from '@/components/ChatTranscript';

// M3b-2 Task 4: the admin Coach Chat. Grounded tool-calling conversation over the analytics
// service — the assistant only cites numbers its tools return. Read tools auto-run and render as
// data cards (see ChatTranscript); action tools (generate/save a worksheet, record an
// intervention) surface as a confirmation card and do nothing until the admin confirms.
// Admin-only via App.tsx's RequireAdmin guard + the role-gated sidebar link.

function summariseArgs(toolName: string, args: any): string {
  if (toolName === 'generate_worksheet') {
    const focus = [...(args?.skillSlugs ?? []), ...(args?.topicSlugs ?? [])].join(', ');
    return `${args?.questionCount ?? '?'} questions${focus ? ` · ${focus}` : ''}`;
  }
  if (toolName === 'save_and_assign_worksheet') return `"${args?.title ?? 'worksheet'}" → ${(args?.studentIds ?? []).length} student(s)`;
  if (toolName === 'create_intervention') return `targets ${(args?.skillSlugs ?? []).join(', ')} · ${args?.recommendation ?? ''}`;
  return JSON.stringify(args ?? {});
}

export default function CoachChat() {
  const [params] = useSearchParams();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [pending, setPending] = useState<PendingAction | undefined>();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Open the session named in ?session= (from an intervention's "View conversation" link), else
  // start a fresh one.
  useEffect(() => {
    const existing = params.get('session');
    (async () => {
      try {
        if (existing) {
          const s = await chatApi.getSession(Number(existing));
          setSessionId(s.id);
          setMessages(s.messages);
        } else {
          const { id } = await chatApi.createSession();
          setSessionId(id);
        }
      } catch (e: any) {
        setError(e?.message ?? 'Could not open the chat.');
      }
    })();
  }, [params]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  function applyResult(r: { messages: ChatMessage[]; suggestedQuestions: string[]; pendingAction?: PendingAction }) {
    setMessages(r.messages);
    setSuggested(r.suggestedQuestions);
    setPending(r.pendingAction);
  }

  async function send(text: string) {
    if (!sessionId || !text.trim() || busy) return;
    setBusy(true);
    setError(null);
    setSuggested([]);
    try {
      applyResult(await chatApi.sendMessage(sessionId, text.trim()));
      setInput('');
    } catch (e: any) {
      setError(e?.message ?? 'The coach could not respond. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function resolve(approve: boolean) {
    if (!sessionId || !pending || busy) return;
    setBusy(true);
    setError(null);
    try {
      applyResult(await chatApi.confirm(sessionId, pending.id, approve));
    } catch (e: any) {
      setError(e?.message ?? 'Could not complete the action.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto w-full">
      <div className="px-1 pt-1 pb-3">
        <h1 className="text-xl font-semibold text-gray-900">Coach Chat</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ask about a student's performance and plan targeted practice. Every number comes from their actual results.
        </p>
      </div>

      <div className="flex-1 overflow-auto py-2">
        <ChatTranscript messages={messages} />

        {busy && (
          <div data-testid="thinking" className="flex gap-2.5 mt-4">
            <div className="w-7 h-7 shrink-0 rounded-lg bg-[#102a4a] text-white grid place-items-center text-xs font-bold">✦</div>
            <div className="rounded-xl rounded-tl-sm border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-400">Thinking…</div>
          </div>
        )}

        {pending && !busy && (
          <div data-testid="pending-action" className="mt-4 max-w-xl rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-amber-100">
              <span className="w-2 h-2 rounded-full bg-brand-amber" />
              <b className="text-sm text-gray-800">Confirm to continue</b>
              <span className="ml-auto text-[11px] font-bold uppercase tracking-wide text-amber-700">awaiting you</span>
            </div>
            <div className="px-4 py-3 text-sm text-gray-700">
              Nothing happens until you confirm.
              <div className="mt-2 text-gray-600">
                <span className="font-semibold capitalize">{pending.toolName.replace(/_/g, ' ')}</span> — {summariseArgs(pending.toolName, pending.args)}
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-3">
              <button onClick={() => resolve(true)} className="rounded-lg bg-brand-green text-white px-3.5 py-2 text-sm font-semibold">Confirm</button>
              <button onClick={() => resolve(false)} className="rounded-lg bg-white text-gray-600 border border-gray-200 px-3.5 py-2 text-sm font-semibold">Cancel</button>
            </div>
          </div>
        )}

        {suggested.length > 0 && !busy && (
          <div className="flex flex-wrap gap-2 mt-4">
            {suggested.map((q) => (
              <button key={q} data-testid="suggested-chip" onClick={() => send(q)} className="rounded-full border border-gray-200 bg-white text-brand-blue px-3 py-1.5 text-[13px] hover:bg-blue-50">
                {q}
              </button>
            ))}
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        <div ref={endRef} />
      </div>

      <div className="border-t border-gray-100 pt-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about a student…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm"
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()} className="rounded-xl bg-brand-blue text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
            Send
          </button>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">The coach only cites numbers its tools return — it can't make a statistic up.</p>
      </div>
    </div>
  );
}
