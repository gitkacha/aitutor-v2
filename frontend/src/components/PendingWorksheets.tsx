import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mathApi, Worksheet, MathWorksheet, WritingType } from '@/lib/api';
import { worksheetStartState } from '@/lib/worksheet-start';
import { parseJsonArray } from '@/lib/parse';
import { Button } from '@/components/ui/button';
import { Calculator, ClipboardList, Pencil } from 'lucide-react';
import MathWorksheetContent from './MathWorksheetContent';

interface PendingWorksheetsProps {
  mode: 'student' | 'admin';
  // Bump to refetch (e.g. after the admin saves a new worksheet).
  refreshKey?: number;
}

// Worksheets nobody has attempted yet, across both subjects — a quick view so
// neither the student nor the admin has to check every topic/type section.
export default function PendingWorksheets({ mode, refreshKey = 0 }: PendingWorksheetsProps) {
  const navigate = useNavigate();
  const [writing, setWriting] = useState<Worksheet[]>([]);
  const [math, setMath] = useState<MathWorksheet[]>([]);
  const [types, setTypes] = useState<WritingType[]>([]);
  // Which pending row (admin) is expanded to show its content — one at a time, keyed
  // `w-<id>` / `m-<id>` so writing and math ids can't clash (W-27).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getWorksheets(), mathApi.getWorksheets(), api.getTypes()])
      .then(([w, m, t]) => {
        setWriting(w.filter((ws) => (ws.attempts || []).length === 0));
        setMath(m.filter((ws) => (ws.attempts || []).length === 0));
        setTypes(t);
      })
      .catch(() => {});
  }, [refreshKey]);

  if (writing.length === 0 && math.length === 0) return null;

  const startMathWorksheet = (ws: MathWorksheet) => {
    const slugs = parseJsonArray<string>(ws.topicIds);
    navigate(`/math/${slugs[0] || 'all-topics'}/start`, { state: { worksheetId: ws.id } });
  };

  const startWritingWorksheet = async (ws: Worksheet) => {
    const brief = types.find((t) => t.id === ws.typeId);
    if (!brief) return;
    const full = await api.getType(brief.slug);
    navigate(`/practice/${full.slug}/start`, { state: worksheetStartState(full, ws) });
  };

  const typeName = (typeId: number) => types.find((t) => t.id === typeId)?.name || 'Writing';

  return (
    <section className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <ClipboardList size={18} className="text-brand-amber" />
        <h2 className="text-lg font-semibold text-gray-900">Pending Worksheets</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        {mode === 'student'
          ? 'Worksheets waiting for you — start one right here.'
          : 'Assigned worksheets the student has not attempted yet.'}
      </p>
      <div className="space-y-2">
        {writing.map((ws) => {
          const prompts = parseJsonArray<string>(ws.prompts);
          const key = `w-${ws.id}`;
          return (
            <div key={key} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Pencil size={16} className="text-brand-blue mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ws.title}</p>
                    <p className="text-xs text-gray-400">
                      Writing · {typeName(ws.typeId)} · {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} · 30 min
                    </p>
                  </div>
                </div>
                {mode === 'student' ? (
                  <Button size="sm" className="shrink-0" onClick={() => startWritingWorksheet(ws)}>
                    Start
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">Created {new Date(ws.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => setExpandedId((id) => (id === key ? null : key))}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      {expandedId === key ? 'Hide' : 'View'}
                    </button>
                  </div>
                )}
              </div>
              {mode === 'admin' && expandedId === key && (
                <div className="mt-3 ml-9 space-y-2">
                  {prompts.map((p, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Prompt {i + 1}</p>
                      <p className="text-sm text-gray-800">{p}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {math.map((ws) => {
          const questions = parseJsonArray<unknown>(ws.questions);
          const key = `m-${ws.id}`;
          return (
            <div key={key} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Calculator size={16} className="text-brand-green mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{ws.title}</p>
                    <p className="text-xs text-gray-400">
                      Mathematics · {questions.length} questions · {questions.length} min
                    </p>
                  </div>
                </div>
                {mode === 'student' ? (
                  <Button size="sm" className="shrink-0" onClick={() => startMathWorksheet(ws)}>
                    Start
                  </Button>
                ) : (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-400 whitespace-nowrap">Created {new Date(ws.createdAt).toLocaleDateString()}</span>
                    <button
                      onClick={() => setExpandedId((id) => (id === key ? null : key))}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      {expandedId === key ? 'Hide' : 'View'}
                    </button>
                  </div>
                )}
              </div>
              {mode === 'admin' && expandedId === key && (
                <div className="mt-3 ml-9">
                  <MathWorksheetContent worksheetId={ws.id} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
