import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, RefreshCw, Film, Upload, X, Sparkles } from 'lucide-react';
import { coachingApi, CoachingModule, GENERATION_POLL_TIMEOUT_MS } from '@/lib/api';
import MarkdownView from '@/components/MarkdownView';
import { withFigures } from '@/components/lessonFigureComponents';
import MediaStage from '@/components/MediaStage';

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
  const [regenerating, setRegenerating] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const [mediaBusy, setMediaBusy] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [instructions, setInstructions] = useState('');
  const [candidates, setCandidates] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  useEffect(() => {
    if (!id) return;
    // W-161: a successful regenerate navigates to the NEW draft's id. Both URLs match the same
    // /admin/modules/:id route, so React keeps this component mounted and `regenerating` would stay
    // true forever (spinner never clears). Reset it whenever the viewed module changes.
    setRegenerating(false);
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

  // W-119: regenerate this skill. Non-destructive — it creates a NEW draft and opens it, so the
  // current lesson is kept and you can compare versions.
  async function regenerate() {
    if (!module) return;
    setRegenerating(true);
    setError(null);
    try {
      const { jobId } = await coachingApi.startGeneration(module.skillId);
      const deadline = Date.now() + GENERATION_POLL_TIMEOUT_MS;
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
      setRegenerating(false);
    }
  }

  // W-127: attach Building-Block media (embed link / uploaded video), or clear it.
  async function runMedia(fn: () => Promise<CoachingModule>) {
    setMediaBusy(true);
    setMediaError(null);
    try {
      setModule(await fn());
      setEmbedUrl('');
    } catch (e) {
      setMediaError((e as Error).message);
    } finally {
      setMediaBusy(false);
    }
  }

  // W-133/W-134: AI animation assistant — suggest a candidate (not stored) then commit the chosen one.
  async function suggestAnimation() {
    if (!module) return;
    setSuggesting(true);
    setMediaError(null);
    try {
      const { jobId } = await coachingApi.suggestAnimation(module.id, instructions.trim() || undefined);
      const deadline = Date.now() + GENERATION_POLL_TIMEOUT_MS;
      for (;;) {
        const job = await coachingApi.getAnimationJob(jobId);
        if (job.status === 'done' && job.result?.svg) {
          setCandidates((c) => [job.result!.svg, ...c]);
          break;
        }
        if (job.status === 'error') throw new Error(job.error || 'Generation failed');
        if (Date.now() > deadline) throw new Error('Generation timed out');
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e) {
      setMediaError((e as Error).message);
    } finally {
      setSuggesting(false);
    }
  }

  async function useCandidate(svg: string) {
    if (!module) return;
    setMediaBusy(true);
    setMediaError(null);
    try {
      setModule(await coachingApi.commitAnimation(module.id, svg));
      setCandidates([]);
    } catch (e) {
      setMediaError((e as Error).message);
    } finally {
      setMediaBusy(false);
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
            {module.skill && <span className="text-gray-500">{module.skill.name}</span>}
            {savedAt && <span className="text-gray-400">Saved</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* W-119: regenerate this skill → a new draft (the current lesson is kept). */}
          <button
            onClick={() => regenerate()}
            disabled={regenerating}
            title="Create a new lesson draft for this skill"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} /> {regenerating ? 'Regenerating…' : 'Regenerate'}
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

      {/* W-127: Building-block media — embed a YouTube/Vimeo link or upload a video. */}
      <div className="mb-4 rounded-xl border border-gray-200 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Film size={16} className="text-brand-blue" /> Building-block media
          <span className="font-normal text-gray-400">— plays on the Intuitive Building Block card</span>
        </div>

        {module.mediaKind && module.mediaKind !== 'none' && (module.mediaUrl || module.mediaSvg) ? (
          <div className="mb-3">
            <div className="max-w-md">
              <MediaStage kind={module.mediaKind} url={module.mediaUrl} svg={module.mediaSvg} />
            </div>
            <button
              onClick={() => runMedia(() => coachingApi.clearMedia(module.id))}
              disabled={mediaBusy}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
            >
              <X size={13} /> Remove media
            </button>
          </div>
        ) : (
          <p className="mb-3 text-sm text-gray-500">No media yet — add a video or generate an animation below (optional).</p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={embedUrl}
            onChange={(e) => setEmbedUrl(e.target.value)}
            placeholder="Paste a YouTube or Vimeo link"
            className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
          <button
            onClick={() => runMedia(() => coachingApi.setMediaEmbed(module.id, embedUrl))}
            disabled={mediaBusy || !embedUrl.trim()}
            className="rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
          >
            Embed
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            <Upload size={14} /> Upload video
            <input
              type="file"
              accept="video/*"
              className="hidden"
              disabled={mediaBusy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) runMedia(() => coachingApi.uploadMedia(module.id, file));
                e.target.value = '';
              }}
            />
          </label>
        </div>

        {/* W-131: lessons with a figure animate the figure itself (hover). W-134: figure-less lessons
            get the AI animation assistant — suggest, preview candidates, keep one, or stay text-only. */}
        {/\`\`\`figure/.test(content) ? (
          <p className="mt-2 text-xs text-gray-500">This lesson has a figure — it's interactive for students (hover to explore), so a separate animation isn't needed.</p>
        ) : (
          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50/60 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-gray-700">
              <Sparkles size={13} className="text-brand-blue" /> AI animation assistant
              <span className="font-normal text-gray-400">— for a text-only concept</span>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Describe the visual you want — or leave blank and let the AI suggest one."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
            />
            <button
              onClick={suggestAnimation}
              disabled={suggesting}
              className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3.5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              <Sparkles size={14} /> {suggesting ? 'Thinking…' : 'Suggest an animation'}
            </button>
            {candidates.length > 0 && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">Preview a suggestion, then keep the one you like:</p>
                {candidates.map((svg, i) => (
                  <div key={i} className="rounded-lg border border-gray-200 p-2">
                    <div className="max-w-sm">
                      <MediaStage kind="animation" svg={svg} />
                    </div>
                    <button
                      onClick={() => useCandidate(svg)}
                      disabled={mediaBusy}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white hover:brightness-95 disabled:opacity-50"
                    >
                      <Check size={13} /> Use this
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {mediaError && <p className="mt-2 text-sm text-red-600">{mediaError}</p>}
      </div>

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
