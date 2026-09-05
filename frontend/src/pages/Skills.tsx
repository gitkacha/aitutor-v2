import { useState, useEffect, ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { skillsApi, mathApi, coachingApi, Skill, MathTopic, CoachingModule } from '@/lib/api';
import { BookOpen, ChevronRight } from 'lucide-react';

// M3a Task 10: read-only browser over the skill taxonomy (Task 2's 89-skill seed) — math
// skills grouped by topic, plus a "Writing criteria" group. Admin-only (see App.tsx's
// RequireAdmin route guard and Sidebar's role-gated link). M3c Phase 2a (W-67): each math
// skill row carries a "Generate lesson" / "View lesson" action.

function SkillRow({
  skill,
  expanded,
  onToggle,
  action,
}: {
  skill: Skill;
  expanded: boolean;
  onToggle: () => void;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gray-100 hover:bg-gray-50">
      <div className="flex items-center gap-2">
        <button
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex items-start justify-between gap-3 flex-1 min-w-0 text-left p-3"
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
        {action && <div className="shrink-0 pr-3">{action}</div>}
      </div>
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
  const navigate = useNavigate();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [topics, setTopics] = useState<MathTopic[]>([]);
  const [modules, setModules] = useState<Map<number, CoachingModule>>(new Map());
  const [generatingSkillId, setGeneratingSkillId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([skillsApi.list(), mathApi.getTopics(), mathApi.getTopics('thinking-skills'), coachingApi.listAll()])
      .then(([s, t, tt, mods]) => {
        setSkills(s);
        // Merge math + Thinking Skills topics so topicName resolves both subjects' section names.
        setTopics([...t, ...tt]);
        // Keep the most recent module per skill (list is newest-first).
        const bySkill = new Map<number, CoachingModule>();
        for (const m of mods) if (!bySkill.has(m.skillId)) bySkill.set(m.skillId, m);
        setModules(bySkill);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function generateLesson(skillId: number) {
    setGeneratingSkillId(skillId);
    setError(null);
    try {
      const { jobId } = await coachingApi.startGeneration(skillId);
      const deadline = Date.now() + 90_000;
      for (;;) {
        const job = await coachingApi.getGenerationJob(jobId);
        if (job.status === 'done' && job.result) {
          navigate(`/admin/modules/${job.result.moduleId}`, {
            state: { verifierWarnings: job.result.verifierWarnings },
          });
          return;
        }
        if (job.status === 'error') throw new Error(job.error || 'Generation failed');
        if (Date.now() > deadline) throw new Error('Generation timed out');
        await new Promise((r) => setTimeout(r, 400));
      }
    } catch (e) {
      setError((e as Error).message);
      setGeneratingSkillId(null);
    }
  }

  const lessonAction = (skill: Skill): ReactNode => {
    if (skill.subject !== 'math') return null;
    const mod = modules.get(skill.id);
    if (mod) {
      return (
        <button
          onClick={() => navigate(`/admin/modules/${mod.id}`)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
        >
          {mod.status === 'approved' ? 'Approved ✓ · View' : 'View draft'}
        </button>
      );
    }
    return (
      <button
        onClick={() => generateLesson(skill.id)}
        disabled={generatingSkillId !== null}
        className="rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
      >
        {generatingSkillId === skill.id ? 'Generating…' : 'Generate lesson'}
      </button>
    );
  };

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
  const thinkingSkills = skills.filter((s) => s.subject === 'thinking-skills');

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

      {modules.size > 0 && (
        <section data-testid="your-lessons" className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900">Your lessons</h2>
            <Link to="/admin/lessons" className="text-xs font-medium text-brand-blue">View all →</Link>
          </div>
          <div className="space-y-2">
            {Array.from(modules.values()).map((m) => (
              <Link
                key={m.id}
                to={`/admin/modules/${m.id}`}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-3 hover:bg-gray-50"
              >
                <span className="text-sm font-medium text-gray-900 flex-1 min-w-0">{m.title}</span>
                <span
                  className={
                    m.status === 'approved'
                      ? 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800'
                      : 'rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800'
                  }
                >
                  {m.status === 'approved' ? 'Approved ✓' : 'Draft'}
                </span>
                <ChevronRight size={16} className="text-gray-400 shrink-0" />
              </Link>
            ))}
          </div>
        </section>
      )}

      {mathGroups.map((g) => (
        <section key={g.slug ?? 'other'} className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">{g.name}</h2>
          <div className="space-y-2">
            {g.skills.map((s) => (
              <SkillRow
                key={s.id}
                skill={s}
                expanded={expanded.has(s.id)}
                onToggle={() => toggle(s.id)}
                action={lessonAction(s)}
              />
            ))}
          </div>
        </section>
      ))}

      {thinkingSkills.length > 0 && (
        <section className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Thinking Skills</h2>
          <div className="space-y-2">
            {thinkingSkills.map((s) => (
              <SkillRow key={s.id} skill={s} expanded={expanded.has(s.id)} onToggle={() => toggle(s.id)} />
            ))}
          </div>
        </section>
      )}

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
