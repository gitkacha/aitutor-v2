import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { coachingApi, mathApi, CoachingModule, MathTopic } from '@/lib/api';
import ApproachBadge from '@/components/ApproachBadge';

// W-79: admin index of every coaching lesson (draft + approved), grouped by topic, so a generated
// lesson is easy to find after generation — including ones generated from chat. Admin-only via the
// RequireAdmin route guard in App.tsx.
function StatusPill({ status }: { status: 'draft' | 'approved' }) {
  return status === 'approved' ? (
    <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">Approved ✓</span>
  ) : (
    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">Draft</span>
  );
}

export default function AdminLessons() {
  const [modules, setModules] = useState<CoachingModule[]>([]);
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([coachingApi.listAll(), mathApi.getTopics()])
      .then(([m, t]) => {
        setModules(m);
        setTopics(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const topicName = (id: number | null | undefined) =>
    topics.find((t) => t.id === id)?.name ?? 'Other';

  // Group by the module's skill topic, topics sorted by name, lessons alphabetical within.
  const groups = Array.from(new Set(modules.map((m) => m.skill?.topicId ?? null)))
    .map((id) => ({
      id,
      name: topicName(id),
      modules: modules
        .filter((m) => (m.skill?.topicId ?? null) === id)
        .sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap size={24} className="text-brand-blue" />
        <h1 className="text-2xl font-bold text-gray-900">Lessons</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        Coaching lessons you've generated. Open one to review, edit or approve it — students only see
        approved lessons.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {modules.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No lessons yet. Generate one from the <Link to="/skills" className="text-brand-blue">Skills</Link> page.
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id ?? 'other'} className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{g.name}</h2>
          <div className="space-y-2">
            {g.modules.map((m) => (
              <Link
                key={m.id}
                to={`/admin/modules/${m.id}`}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  {m.skill && <p className="text-xs text-gray-500 mt-0.5">{m.skill.name}</p>}
                </div>
                <ApproachBadge approach={m.approach} />
                <StatusPill status={m.status} />
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
