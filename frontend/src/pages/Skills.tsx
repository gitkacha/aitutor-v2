import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { skillsApi, mathApi, Skill, MathTopic } from '@/lib/api';
import { BookOpen, ChevronRight } from 'lucide-react';

// M3a Task 10: read-only browser over the skill taxonomy (Task 2's 89-skill seed) — math
// skills grouped by topic, plus a "Writing criteria" group. Admin-only (see App.tsx's
// RequireAdmin route guard and Sidebar's role-gated link).

function SkillRow({ skill, expanded, onToggle }: { skill: Skill; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="rounded-lg border border-gray-100 hover:bg-gray-50">
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex items-start justify-between gap-3 w-full text-left p-3"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{skill.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{skill.description}</p>
        </div>
        <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-brand-blue mt-0.5">
          Details
          <ChevronRight size={14} className={cn('transition-transform', expanded && 'rotate-90')} />
        </span>
      </button>
      {expanded && (
        <div className="mx-3 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Exam-level notes</p>
          <p className="text-sm text-gray-800">{skill.examLevelNotes}</p>
        </div>
      )}
    </div>
  );
}

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([skillsApi.list(), mathApi.getTopics()])
      .then(([s, t]) => {
        setSkills(s);
        setTopics(t);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const topicName = (slug: string | null) => topics.find((t) => t.slug === slug)?.name ?? slug ?? 'Other';

  const mathSkills = skills.filter((s) => s.subject === 'math');
  const writingSkills = skills.filter((s) => s.subject === 'writing');

  const mathGroups = Array.from(new Set(mathSkills.map((s) => s.topicSlug)))
    .sort((a, b) => topicName(a).localeCompare(topicName(b)))
    .map((slug) => ({ slug, name: topicName(slug), skills: mathSkills.filter((s) => s.topicSlug === slug) }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <BookOpen size={24} className="text-brand-blue" />
        <h1 className="text-2xl font-bold text-gray-900">Skills</h1>
      </div>
      <p className="text-sm text-gray-500 -mt-6">
        The full skill taxonomy behind worksheet targeting and reporting — read-only.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mathGroups.map((g) => (
        <section key={g.slug ?? 'other'} className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{g.name}</h2>
          <div className="space-y-2">
            {g.skills.map((s) => (
              <SkillRow key={s.id} skill={s} expanded={expanded.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>
        </section>
      ))}

      {writingSkills.length > 0 && (
        <section className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Writing criteria</h2>
          <div className="space-y-2">
            {writingSkills.map((s) => (
              <SkillRow key={s.id} skill={s} expanded={expanded.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
