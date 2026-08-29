import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, mathApi, coachingApi, Worksheet, MathWorksheet, WritingType, CoachingAssignmentSummary, AuthUser } from '@/lib/api';
import { worksheetStartState } from '@/lib/worksheet-start';
import { parseJsonArray } from '@/lib/parse';
import { Button } from '@/components/ui/button';
import { Calculator, ClipboardList, Pencil, GraduationCap, ChevronRight } from 'lucide-react';
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
  // W-74: incomplete assigned lessons, shown as "Learn" cards BEFORE the practice worksheets
  // (learn → practise ordering). Student mode only.
  const [lessons, setLessons] = useState<CoachingAssignmentSummary[]>([]);
  // Which pending row (admin) is expanded to show its content — one at a time, keyed
  // `w-<id>` / `m-<id>` so writing and math ids can't clash (W-27).
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // W-99: admin can assign a pending worksheet to students directly from this list.
  const [students, setStudents] = useState<AuthUser[]>([]);
  const [assignKey, setAssignKey] = useState<string | null>(null);
  const [assignSel, setAssignSel] = useState<Set<number>>(new Set());

  const reloadMath = () => mathApi.getWorksheets().then((m) => setMath(m.filter((ws) => (ws.attempts || []).length === 0))).catch(() => {});

  useEffect(() => {
    Promise.all([api.getWorksheets(), mathApi.getWorksheets(), api.getTypes()])
      .then(([w, m, t]) => {
        setWriting(w.filter((ws) => (ws.attempts || []).length === 0));
        setMath(m.filter((ws) => (ws.attempts || []).length === 0));
        setTypes(t);
      })
      .catch(() => {});
    if (mode === 'student') {
      coachingApi.myAssignments()
        .then((a) => setLessons(a.filter((x) => x.completedAt === null)))
        .catch(() => {});
    }
    if (mode === 'admin') {
      api.getWorkspaceUsers().then((r) => setStudents(r.users.filter((u) => u.role === 'student'))).catch(() => {});
    }
  }, [refreshKey, mode]);

  const toggleAssign = (sid: number) =>
    setAssignSel((prev) => { const n = new Set(prev); n.has(sid) ? n.delete(sid) : n.add(sid); return n; });
  const submitAssign = async (ws: MathWorksheet) => {
    const ids = [...assignSel];
    if (ids.length === 0) return;
    try {
      await mathApi.assignWorksheet(ws.id, ids);
      setAssignKey(null);
      setAssignSel(new Set());
      reloadMath();
    } catch { /* keep the panel open on error */ }
  };

  if (writing.length === 0 && math.length === 0 && lessons.length === 0) return null;

  const hasPractice = writing.length > 0 || math.length > 0;
  // Interventions that still have an incomplete lesson — their paired worksheet gets a soft hint.
  const pairedInterventionIds = new Set(
    lessons.map((l) => l.interventionId).filter((x): x is number => x != null),
  );
  const bestAfterLesson = (interventionId: number | null | undefined) =>
    interventionId != null && pairedInterventionIds.has(interventionId);

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
    <section data-testid="pending-worksheets" className="bg-white rounded-xl p-6 border border-gray-200">
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
        {/* W-74: assigned lessons come first — learn the method, then practise. */}
        {lessons.map((l) => (
          <Link
            key={`l-${l.id}`}
            to={`/lesson/${l.moduleId}`}
            className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-100 bg-green-50/60 hover:bg-green-50"
          >
            <div className="flex items-start gap-3 min-w-0">
              <GraduationCap size={16} className="text-brand-green mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">Learn: {l.title}</p>
                <p className="text-xs text-gray-500">Lesson · best before you practise</p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-green">
              Learn <ChevronRight size={14} />
            </span>
          </Link>
        ))}
        {mode === 'student' && lessons.length > 0 && hasPractice && (
          <p className="pt-1 pb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Then practise</p>
        )}
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
                    {mode === 'student' && bestAfterLesson(ws.interventionId) && (
                      <p className="text-xs font-medium text-brand-green mt-0.5">✨ best after the lesson</p>
                    )}
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
                      {ws.subject === 'thinking-skills' ? 'Thinking Skills' : 'Mathematics'} · {questions.length} questions · {questions.length} min
                    </p>
                    {mode === 'student' && bestAfterLesson(ws.interventionId) && (
                      <p className="text-xs font-medium text-brand-green mt-0.5">✨ best after the lesson</p>
                    )}
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
                      onClick={() => { setAssignKey((k) => (k === key ? null : key)); setAssignSel(new Set()); }}
                      className="text-xs font-medium text-brand-green hover:underline"
                    >
                      Assign
                    </button>
                    <button
                      onClick={() => setExpandedId((id) => (id === key ? null : key))}
                      className="text-xs font-medium text-brand-blue hover:underline"
                    >
                      {expandedId === key ? 'Hide' : 'View'}
                    </button>
                  </div>
                )}
              </div>
              {mode === 'admin' && assignKey === key && (
                <div className="mt-3 ml-9 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign to students</p>
                  {students.length === 0 ? (
                    <p className="text-xs text-gray-400">No students in this workspace yet.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                        {students.map((s) => (
                          <label key={s.id} className="flex items-center gap-1.5 text-sm text-gray-700">
                            <input type="checkbox" checked={assignSel.has(s.id)} onChange={() => toggleAssign(s.id)} />
                            {s.name}
                          </label>
                        ))}
                      </div>
                      <button
                        onClick={() => submitAssign(ws)}
                        disabled={assignSel.size === 0}
                        className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Assign{assignSel.size ? ` ${assignSel.size}` : ''}
                      </button>
                    </>
                  )}
                </div>
              )}
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
