import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, GraduationCap } from 'lucide-react';
import { coachingApi, CoachingModule } from '@/lib/api';
import MarkdownView from '@/components/MarkdownView';

// M3c Phase 2b (W-73): the student Lesson page. Renders an approved lesson's markdown in a calm,
// encouraging layout (Direction A) and lets the student mark it complete (which lazily records the
// assignment server-side). A non-approved/unknown id 404s → a friendly "not available" message.
export default function Lesson() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<CoachingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!id) return;
    coachingApi
      .get(Number(id))
      .then(setModule)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  async function markComplete() {
    if (!module) return;
    setCompleting(true);
    try {
      await coachingApi.complete(module.id);
      setCompleted(true);
    } finally {
      setCompleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (notFound || !module) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center">
        <GraduationCap size={32} className="text-gray-300 mx-auto mb-3" />
        <p className="text-gray-600">This lesson isn't available yet. Check back soon!</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-sm text-brand-blue">← Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-brand-blue mb-4">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-green mb-2">
        <GraduationCap size={15} /> Lesson
      </div>
      <h1 className="text-3xl font-bold text-gray-900 mb-1">{module.title}</h1>
      {module.skill && <p className="text-sm text-gray-500 mb-6">{module.skill.name}</p>}

      <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8">
        <MarkdownView content={module.content} />
      </div>

      <div className="mt-6 flex items-center gap-3">
        {completed ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-800">
            <Check size={16} /> Completed — nice work!
          </span>
        ) : (
          <button
            onClick={markComplete}
            disabled={completing}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-green px-5 py-2.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            <Check size={16} /> {completing ? 'Saving…' : 'Mark as complete'}
          </button>
        )}
      </div>
    </div>
  );
}
