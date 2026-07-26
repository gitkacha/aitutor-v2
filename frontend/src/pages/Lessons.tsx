import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GraduationCap, ChevronRight } from 'lucide-react';
import { coachingApi, mathApi, CoachingModule, MathTopic } from '@/lib/api';

// M3c Phase 2b (W-72): the student Lessons library — every approved lesson, grouped by topic, so a
// student can learn a method whenever they like (not only when one is set for them). Approved-only
// (drafts never reach students, enforced server-side).
export default function Lessons() {
  const [modules, setModules] = useState<CoachingModule[]>([]);
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([coachingApi.listApproved(), mathApi.getTopics()])
      .then(([m, t]) => {
        setModules(m);
        setTopics(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const topicName = (id: number | null | undefined) => topics.find((t) => t.id === id)?.name ?? 'Other';

  const groups = Array.from(new Set(modules.map((m) => m.skill?.topicId ?? null)))
    .map((id) => ({
      id,
      name: topicName(id),
      modules: modules.filter((m) => (m.skill?.topicId ?? null) === id).sort((a, b) => a.title.localeCompare(b.title)),
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
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <GraduationCap size={24} className="text-brand-green" />
        <h1 className="text-2xl font-bold text-gray-900">Lessons</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-4">
        Short lessons that teach one skill each. Learn a method here, then practise it — most take
        under 5 minutes.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {modules.length === 0 && !error && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          No lessons yet. Your coach will add some soon!
        </div>
      )}

      {groups.map((g) => (
        <section key={g.id ?? 'other'} className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{g.name}</h2>
          <div className="space-y-2">
            {g.modules.map((m) => (
              <Link
                key={m.id}
                to={`/lesson/${m.id}`}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{m.title}</p>
                  {m.skill && <p className="text-xs text-gray-500 mt-0.5">{m.skill.name}</p>}
                </div>
                <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-brand-blue">
                  Learn the method <ChevronRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
