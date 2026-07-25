import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { analyticsApi, SkillTrendPoint } from '@/lib/api';

// M3b-2 Task 6: accuracy-over-time for one skill, with a dashed marker at each intervention date —
// the "was struggling here, we did this, line goes up" view. Mirrors ScoreHistory's LineChart.

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SkillTrendChart({ studentId, slug, interventionDates = [] }: {
  studentId: number;
  slug: string;
  interventionDates?: string[];
}) {
  const [points, setPoints] = useState<SkillTrendPoint[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    analyticsApi.skillTrend(studentId, slug)
      .then((p) => { if (!cancelled) setPoints(p); })
      .catch(() => { if (!cancelled) setPoints([]); });
    return () => { cancelled = true; };
  }, [studentId, slug]);

  if (!points || points.length === 0) return null;

  const data = points.map((p) => ({ label: fmtDate(p.finishedAt), pct: Math.round(p.accuracy * 100), finishedAt: p.finishedAt }));

  return (
    <div data-testid="skill-trend-chart" className="mt-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">Accuracy over time</p>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef1f5" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9aa4b2' }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 11, fill: '#9aa4b2' }} axisLine={false} tickLine={false} width={40} />
          <Tooltip formatter={(v: number) => [`${v}%`, 'accuracy']} labelStyle={{ fontSize: 12 }} />
          {interventionDates.map((d) => {
            const label = fmtDate(d);
            return <ReferenceLine key={d} x={label} stroke="#f2a71b" strokeDasharray="4 3" strokeWidth={2} />;
          })}
          <Line type="monotone" dataKey="pct" stroke="#1c6dd0" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
