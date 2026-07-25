import { useState, useEffect } from 'react';
import { interventionsApi, ActiveIntervention } from '@/lib/api';
import { INTERVENTION_STATUS_LABEL, interventionStatusClasses } from '@/lib/intervention-status';

// M3b-2 Task 6: workspace-wide "who needs attention" strip — one card per active intervention
// across all students, with the recomputed outcome status. Read-only overview above the
// per-student journey.

function ageDays(iso: string): string {
  const d = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return d === 0 ? 'today' : d === 1 ? '1 day' : `${d} days`;
}

export default function ActiveInterventionsStrip() {
  const [items, setItems] = useState<ActiveIntervention[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    interventionsApi.listActive()
      .then((d) => { if (!cancelled) setItems(d); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <div data-testid="active-interventions" className="mb-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">Active interventions · workspace</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((iv) => (
          <div key={iv.id} data-testid="active-intervention-card" className="rounded-xl border border-gray-200 bg-white p-3.5">
            <div className="flex items-center gap-2">
              <b className="text-sm text-gray-900">{iv.studentName}</b>
              <span className="ml-auto text-[11px] text-gray-400">{ageDays(iv.createdAt)}</span>
            </div>
            <div className="text-xs text-gray-600 mt-1.5">{(iv.skillNames?.length ? iv.skillNames : [iv.skillSlugs]).join(', ')}</div>
            <div className="mt-2.5">
              <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-0.5 rounded-full ${interventionStatusClasses(iv.status)}`} data-status={iv.status}>
                {INTERVENTION_STATUS_LABEL[iv.status] ?? iv.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
