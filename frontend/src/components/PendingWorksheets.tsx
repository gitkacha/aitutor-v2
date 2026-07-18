import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, mathApi, Worksheet, MathWorksheet, WritingType } from '@/lib/api';
import { worksheetStartState } from '@/lib/worksheet-start';
import { parseJsonArray } from '@/lib/parse';
import { Button } from '@/components/ui/button';
import { Calculator, ClipboardList, Pencil } from 'lucide-react';

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
          return (
            <div key={`w-${ws.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
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
                <span className="text-xs text-gray-400 shrink-0">Created {new Date(ws.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          );
        })}
        {math.map((ws) => {
          const questions = parseJsonArray<unknown>(ws.questions);
          return (
            <div key={`m-${ws.id}`} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
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
                <span className="text-xs text-gray-400 shrink-0">Created {new Date(ws.createdAt).toLocaleDateString()}</span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
