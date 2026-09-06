import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, RefreshCw } from 'lucide-react';
import { coachingApi, CoachingModule } from '@/lib/api';
import MarkdownView from '@/components/MarkdownView';
import { withFigures } from '@/components/lessonFigureComponents';
import ApproachBadge from '@/components/ApproachBadge';

// M3c Phase 2a (W-68): admin module editor. Loads a draft/approved module, shows a live markdown
// preview beside the raw text, surfaces any unresolved verifier warnings (passed via router state
// from the generate flow), and lets the admin Save edits or Approve. Editing an approved module
// bumps its version (server-side). Admin-only via the RequireAdmin route guard in App.tsx.
export default function ModuleEditor() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const initialWarnings = (location.state as { verifierWarnings?: string[] } | null)?.verifierWarnings ?? [];

  const [module, setModule] = useState<CoachingModule | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [warnings, setWarnings] = useState<string[]>(initialWarnings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState<'standard' | 'tactical' | null>(null);

  useEffect(() => {
    if (!id) return;
    coachingApi
      .get(Number(id))
      .then((m) => {
        setModule(m);
        setTitle(m.title);
        setContent(m.content);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!module) return;
    setSaving(true);
    try {
      const updated = await coachingApi.update(module.id, { title, content });
      setModule(updated);
      setSavedAt(Date.now());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function approve() {
    if (!module) return;
    setApproving(true);
    try {
      // Persist any pending edits first, then approve.
      await coachingApi.update(module.id, { title, content });
      const approved = await coachingApi.approve(module.id);
      setModule(approved);
      setWarnings([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setApproving(false);
    }
  }

  // W-119: regenerate this skill with either approach. Non-destructive — it creates a NEW draft and
  // opens it, so the current lesson is kept and both A/B versions can be compared.
  async function regenerate(approach: 'standard' | 'tactical') {
    if (!module) return;
    setRegenerating(approach);
    setError(null);
    try {
      const { jobId } = await coachingApi.startGeneration(module.skillId, approach);
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
      setRegenerating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }
  if (error || !module) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <p className="text-red-600">{error || 'Lesson not found.'}</p>
      </div>
    );
  }

  const isApproved = module.status === 'approved';

  return (
    <div className="max-w-6xl mx-auto p-6">
      <Link to="/skills" className="inline-flex items-center gap-1 text-sm text-brand-blue mb-4">
        <ArrowLeft size={15} /> Back to Skills
      </Link>

      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <input
            aria-label="Lesson title"
            className="w-full text-2xl font-bold text-gray-900 border-b border-transparent focus:border-gray-300 focus:outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <span
              className={
                isApproved
                  ? 'rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800'
                  : 'rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800'
              }
            >
              {isApproved ? 'Approved' : 'Draft'}
            </span>
            <ApproachBadge approach={module.approach} />
            {module.skill && <span className="text-gray-500">{module.skill.name}</span>}
            {savedAt && <span className="text-gray-400">Saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* W-119: regenerate the same skill with either approach → a new draft, for same-skill A/B. */}
          <button
            onClick={() => regenerate('standard')}
            disabled={regenerating !== null}
            title="Create a new Standard-approach draft for this skill"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} /> {regenerating === 'standard' ? 'Regenerating…' : 'Regenerate as Standard'}
          </button>
          <button
            onClick={() => regenerate('tactical')}
            disabled={regenerating !== null}
            title="Create a new Tactical-approach draft for this skill"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue px-3 py-2 text-sm font-medium text-brand-blue hover:bg-blue-50 disabled:opacity-50"
          >
            <RefreshCw size={14} /> {regenerating === 'tactical' ? 'Regenerating…' : 'Regenerate as Tactical'}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={approve}
            disabled={approving || isApproved}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            <Check size={16} /> {isApproved ? 'Approved' : approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm mb-1">
            <AlertTriangle size={16} /> The maths checker flagged something — please fix before approving
          </div>
          <ul className="list-disc pl-6 text-sm text-amber-900 space-y-0.5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Markdown</label>
          <textarea
            aria-label="Lesson content"
            className="w-full h-[65vh] rounded-xl border border-gray-200 p-4 font-mono text-sm text-gray-800 focus:outline-none focus:border-brand-blue"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Preview</label>
          <div className="h-[65vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-5">
            <MarkdownView content={content} components={withFigures()} />
          </div>
        </div>
      </div>
    </div>
  );
}
