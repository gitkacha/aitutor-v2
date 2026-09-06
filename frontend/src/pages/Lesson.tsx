import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, GraduationCap, Sparkles, ListOrdered, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Components } from 'react-markdown';
import { coachingApi, CoachingModule } from '@/lib/api';
import MarkdownView from '@/components/MarkdownView';
import { withFigures } from '@/components/lessonFigureComponents';

// M3c Phase 2b (W-73/W-81): the student Lesson page in the "Playbook" style (Direction A). The
// lesson markdown (§8.1 sections) is split on `##` headings and each section is rendered on a
// guided step-spine with its own treatment: the speed technique becomes a green "Your trick"
// callout, the traps become amber "Gotcha" cards, and the rest read as clean steps/examples.

type Kind = 'idea' | 'steps' | 'trick' | 'examples' | 'traps' | 'other';
interface Section { kind: Kind; heading: string; body: string }

export function classify(heading: string): Kind {
  const h = heading.toLowerCase();
  // Tactical (approach B, W-118) headings, mapped to sensible treatments. "The Selective Trap" is the
  // hook (an idea), NOT a "traps to avoid" section — so it must be checked before the generic 'trap'
  // rule below or it would wrongly render as amber gotcha cards.
  if (h.includes('selective trap')) return 'idea';
  if (h.includes('building block') || h.includes('mental model')) return 'steps';
  if (h.includes('drill') || h.includes('guided')) return 'examples';
  // Standard (approach A) headings — unchanged.
  if (h.includes('idea')) return 'idea';
  if (h.includes('step')) return 'steps';
  if (h.includes('trick') || h.includes('speed') || h.includes('faster') || h.includes('shortcut')) return 'trick';
  if (h.includes('example')) return 'examples';
  if (h.includes('trap') || h.includes('gotcha') || h.includes('avoid') || h.includes('watch')) return 'traps';
  return 'other';
}

// Split "## Heading\nbody..." blocks. Anything before the first heading is kept as an intro.
function parseSections(md: string): { intro: string; sections: Section[] } {
  const parts = md.split(/^##\s+/m);
  const intro = parts[0].trim();
  const sections = parts.slice(1).map((block) => {
    const nl = block.indexOf('\n');
    const heading = (nl === -1 ? block : block.slice(0, nl)).trim();
    const body = (nl === -1 ? '' : block.slice(nl + 1)).trim();
    return { kind: classify(heading), heading, body };
  });
  return { intro, sections };
}

const NODE: Record<Kind, { icon: ReactNode; ring: string }> = {
  idea: { icon: <Sparkles size={16} />, ring: 'border-brand-blue text-brand-blue' },
  steps: { icon: <ListOrdered size={16} />, ring: 'border-brand-blue text-brand-blue' },
  trick: { icon: <Zap size={16} />, ring: 'border-brand-green text-brand-green' },
  examples: { icon: <CheckCircle2 size={16} />, ring: 'border-brand-blue text-brand-blue' },
  traps: { icon: <AlertTriangle size={16} />, ring: 'border-brand-amber text-amber-700' },
  other: { icon: <Sparkles size={16} />, ring: 'border-gray-300 text-gray-400' },
};

// Traps render as amber "gotcha" cards, one per bullet.
const trapComponents: Components = {
  ul: ({ children }) => <div className="space-y-2">{children}</div>,
  ol: ({ children }) => <div className="space-y-2">{children}</div>,
  li: ({ children }) => (
    <div className="relative rounded-xl bg-amber-50 py-2.5 pl-10 pr-4 text-[15px] text-amber-900">
      <span className="absolute left-3 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-brand-amber text-xs font-bold text-white">!</span>
      {children}
    </div>
  ),
  p: ({ children }) => <>{children}</>,
};

function SectionBlock({ section, headingLabel }: { section: Section; headingLabel: string }) {
  const node = NODE[section.kind];
  return (
    <section className="relative pl-12">
      <div className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full border-2 bg-white ${node.ring}`}>
        {node.icon}
      </div>
      <h2 className="text-lg font-bold text-gray-900 mb-2">{headingLabel}</h2>
      {section.kind === 'trick' ? (
        <div className="rounded-2xl bg-green-50 p-4">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-green-800">
            <Zap size={13} /> Show-off move
          </div>
          <div className="text-green-900">
            <MarkdownView content={section.body} components={withFigures()} />
          </div>
        </div>
      ) : section.kind === 'traps' ? (
        <MarkdownView content={section.body} components={withFigures(trapComponents)} />
      ) : (
        <MarkdownView content={section.body} components={withFigures()} />
      )}
    </section>
  );
}

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

  const { intro, sections } = parseSections(module.content);
  const readMin = Math.max(1, Math.round(module.content.split(/\s+/).length / 200));

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-brand-blue mb-4">
        <ArrowLeft size={15} /> Back
      </button>

      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-green mb-2">
        <GraduationCap size={15} /> Lesson
      </div>
      <h1 className="text-3xl font-bold text-gray-900">{module.title}</h1>
      <div className="mt-1.5 flex items-center gap-4 text-sm text-gray-500 mb-8">
        <span className="inline-flex items-center gap-1.5">⏱ {readMin} min read</span>
        {module.skill && <span>◆ {module.skill.name}</span>}
      </div>

      {intro && (
        <div className="mb-6">
          <MarkdownView content={intro} components={withFigures()} />
        </div>
      )}

      {/* The step-spine: a vertical line the section nodes sit on. */}
      <div className="relative space-y-7">
        <div className="absolute left-4 top-2 bottom-2 w-px bg-gray-200" aria-hidden />
        {sections.map((s, i) => (
          <SectionBlock key={i} section={s} headingLabel={s.heading} />
        ))}
      </div>

      <div className="mt-8 flex items-center gap-3">
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
