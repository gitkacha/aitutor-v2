import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { interventionsApi, InterventionWithOutcome } from '@/lib/api';
import SkillTrendChart from './SkillTrendChart';
import { INTERVENTION_STATUS_LABEL, interventionStatusClasses } from '@/lib/intervention-status';

// M3b-2 Task 5: the Improvement Journey for one student — the intervention ledger rendered as a
// timeline. Each card shows the frozen diagnosis, the coach's recommendation + rationale
// verbatim, a link back to the conversation, the assigned artifacts, and a LIVE before→after
// outcome recomputed by the API (never stored). Read-only.

function pct(x: number | null | undefined): string {
  return x == null ? '—' : `${Math.round(x * 100)}%`;
}

function StatusChip({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${interventionStatusClasses(status)}`} data-status={status}>
      {INTERVENTION_STATUS_LABEL[status] ?? status}
    </span>
  );
}

function parseArray<T = unknown>(raw: string): T[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function snapshotSkills(raw: string): Array<{ slug: string; name?: string; accuracy?: number }> {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v?.skills) ? v.skills : [];
  } catch {
    return [];
  }
}

function InterventionCard({ iv }: { iv: InterventionWithOutcome }) {
  const skills = snapshotSkills(iv.diagnosisSnapshot);
  const mathWs = (() => { try { return (JSON.parse(iv.worksheetIds)?.math ?? []).length; } catch { return 0; } })();
  const modules = parseArray(iv.coachingModuleIds).length;
  const date = new Date(iv.createdAt).toLocaleDateString();

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden" data-testid="intervention-card">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
        <span className="text-xs text-gray-500 tabular-nums">{date}</span>
        <b className="text-[15px] text-gray-900">{skills.map((s) => s.name ?? s.slug).join(', ') || 'Intervention'}</b>
        {iv.chatSessionId != null && (
          <Link to={`/coach?session=${iv.chatSessionId}`} className="ml-auto text-xs text-brand-blue">View conversation →</Link>
        )}
      </div>
      <div className="grid md:grid-cols-2">
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Diagnosis at the time · frozen</p>
          <div className="text-sm text-gray-700 space-y-1">
            {skills.map((s) => (
              <div key={s.slug}><span className="font-semibold tabular-nums text-red-600">{pct(s.accuracy)}</span> · {s.name ?? s.slug}</div>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-4 mb-1">The coach recommended</p>
          <p className="text-sm text-gray-800">{iv.recommendation}</p>
          {iv.rationale && <p className="text-sm text-gray-500 mt-1 italic">“{iv.rationale}”</p>}
          {(mathWs > 0 || modules > 0) && (
            <div className="flex gap-2 flex-wrap mt-3">
              {mathWs > 0 && <span className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600"><span className="text-brand-blue font-bold">Worksheet</span> ×{mathWs}</span>}
              {modules > 0 && <span className="text-xs border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600"><span className="text-brand-blue font-bold">Lesson</span> ×{modules}</span>}
            </div>
          )}
        </div>
        <div className="p-4 border-t md:border-t-0 md:border-l border-gray-100">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Outcome · recomputed live</p>
          <div className="space-y-2">
            {iv.outcome.perSkill.map((o) => (
              <div key={o.slug} className="flex items-center gap-2 text-sm">
                <span className="font-medium text-gray-700">{skills.find((s) => s.slug === o.slug)?.name ?? o.slug}</span>
                <span className="tabular-nums text-gray-500">{pct(o.before)}</span>
                <span className="text-gray-300">→</span>
                <span className="tabular-nums font-bold text-green-700">{pct(o.postAccuracy)}</span>
                <span className="ml-auto"><StatusChip status={o.status} /></span>
              </div>
            ))}
            {iv.outcome.perSkill.length === 0 && <p className="text-sm text-gray-400">No post-intervention attempts yet.</p>}
          </div>
          {skills[0] && <SkillTrendChart studentId={iv.studentId} slug={skills[0].slug} interventionDates={[iv.createdAt]} />}
        </div>
      </div>
    </div>
  );
}

export default function ImprovementJourney({ studentId }: { studentId?: number }) {
  const [items, setItems] = useState<InterventionWithOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (studentId == null) { setItems(null); return; }
    let cancelled = false;
    setItems(null);
    setError(null);
    interventionsApi.list(studentId)
      .then((data) => { if (!cancelled) setItems(data); })
      .catch((e) => { if (!cancelled) setError(e?.message ?? 'Could not load interventions.'); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (studentId == null) return null;

  return (
    <div data-testid="improvement-journey">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Improvement Journey</h2>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {items && items.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-500 text-center">
          No interventions yet. Start a Coach Chat about this student to diagnose a focus area and propose a plan.
        </div>
      )}
      {items && items.length > 0 && (
        <div className="flex flex-col gap-4">
          {items.map((iv) => <InterventionCard key={iv.id} iv={iv} />)}
        </div>
      )}
    </div>
  );
}
