import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, ChevronLeft, ChevronRight, GraduationCap, Sparkles, ListOrdered, Zap, CheckCircle2, AlertTriangle } from 'lucide-react';
import type { Components } from 'react-markdown';
import { coachingApi, CoachingModule } from '@/lib/api';
import MarkdownView from '@/components/MarkdownView';
import { withFigures } from '@/components/lessonFigureComponents';
import LessonQuiz, { parseQuiz, type QuizQuestion } from '@/components/LessonQuiz';
import MediaStage from '@/components/MediaStage';

// M3c Phase 2b + W-124/W-125: the student Lesson page is a segment-by-segment "player" — the lesson
// markdown (§8.1 sections) is split on `##` headings and ONE section is shown per card, with a quiet
// progress/step header (content is the hero) and Back/Next. The final Guided Quiz card gates
// completion: "Mark complete" stays locked until every embedded quiz is answered correctly.
// Each section keeps its treatment: the speed technique is a green "Show-off move" callout, traps are
// amber "gotcha" cards, figures/quizzes render via the shared block engine.

type Kind = 'idea' | 'steps' | 'trick' | 'examples' | 'traps' | 'other';
interface Section { kind: Kind; heading: string; body: string }

export function classify(heading: string): Kind {
  const h = heading.toLowerCase();
  // Tactical (approach B, W-118) headings, mapped to sensible treatments. "The Selective Trap" is the
  // hook (an idea), NOT a "traps to avoid" section — so it must be checked before the generic 'trap'
  // rule below or it would wrongly render as amber gotcha cards.
  if (h.includes('selective trap')) return 'idea';
  if (h.includes('building block') || h.includes('mental model')) return 'steps';
  if (h.includes('drill') || h.includes('guided') || h.includes('quiz')) return 'examples';
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

// Per-kind accent used by the quiet progress + step header.
const ACCENT: Record<Kind, string> = {
  idea: '#1c6dd0', steps: '#1c6dd0', trick: '#2e9e5b', examples: '#1c6dd0', traps: '#f2a71b', other: '#1c6dd0',
};

// Pull the ```quiz specs out of a section body, returning the remaining prose separately so the
// player can render the quizzes interactively (with completion gating) instead of inline.
function extractQuizzes(body: string): { prose: string; quizzes: QuizQuestion[] } {
  const quizzes: QuizQuestion[] = [];
  const prose = body
    .replace(/```quiz\s*([\s\S]*?)```/g, (whole, inner: string) => {
      const q = parseQuiz(inner);
      if (q) { quizzes.push(q); return ''; }
      return whole;
    })
    .trim();
  return { prose, quizzes };
}

// W-132: does a card's text refer to a figure/chart it should be able to see? Kind-agnostic (works
// for pie/bar/line/table/grid/shape/…), so a figure is shown wherever it's discussed.
const FIGURE_REF = /\b(figure|chart|graph|diagram|table|grid|pie|slice|slices|sector|shape|picture|image|protractor|compass)\b/i;
export function referencesFigure(text: string): boolean {
  return FIGURE_REF.test(text) || /shown above|the visual/i.test(text);
}

// The nearest ```figure block introduced in a card BEFORE `idx` (null if none) — the figure this
// card references but doesn't embed. Kind-agnostic: it's rendered by the shared block renderer.
export function figureCarriedTo(cards: Section[], idx: number): string | null {
  for (let i = idx - 1; i >= 0; i--) {
    const m = cards[i].body.match(/```figure[\s\S]*?```/);
    if (m) return m[0];
  }
  return null;
}

// The body of one section, keeping each kind's treatment but WITHOUT the heading (the player's header
// already shows the segment title).
function SegmentBody({ section }: { section: Section }) {
  if (section.kind === 'trick') {
    return (
      <div className="rounded-2xl bg-green-50 p-4">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-green-800">
          <Zap size={13} /> Show-off move
        </div>
        <div className="text-green-900">
          <MarkdownView content={section.body} components={withFigures()} />
        </div>
      </div>
    );
  }
  if (section.kind === 'traps') {
    return <MarkdownView content={section.body} components={withFigures(trapComponents)} />;
  }
  return <MarkdownView content={section.body} components={withFigures()} />;
}

export default function Lesson() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<CoachingModule | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [solved, setSolved] = useState<Set<number>>(new Set());

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
  // A lesson with no `##` sections (shouldn't happen, but guard) falls back to a single card.
  const cards: Section[] = sections.length > 0 ? sections : [{ kind: 'other', heading: module.title, body: module.content }];
  const idx = Math.min(current, cards.length - 1);
  const section = cards[idx];
  const total = cards.length;
  const isLast = idx === total - 1;
  const accent = ACCENT[section.kind];

  const { prose, quizzes } = extractQuizzes(section.body);
  const hasQuiz = quizzes.length > 0;
  const allSolved = quizzes.length === 0 || solved.size >= quizzes.length;
  const node = NODE[section.kind];

  // The media stage (W-127) lives on the Building-Block card (fallback: the 2nd card).
  const buildingBlockIdx = (() => {
    const i = cards.findIndex((s) => /building block|mental model/i.test(s.heading));
    return i >= 0 ? i : Math.min(1, cards.length - 1);
  })();
  const hasMedia = module.mediaKind && module.mediaKind !== 'none' &&
    (module.mediaKind === 'animation' ? !!module.mediaSvg : !!module.mediaUrl);
  // W-131: one visual per card — if the card already has an inline figure (now interactive), the
  // figure is the visual and the media stage is suppressed.
  const sectionHasFigure = /```figure/.test(section.body);
  const showMedia = idx === buildingBlockIdx && hasMedia && !sectionHasFigure;
  // W-132: if this card discusses a figure but doesn't embed one, carry the nearest earlier figure in.
  const carriedFigure = !sectionHasFigure && referencesFigure(section.body) ? figureCarriedTo(cards, idx) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-brand-blue mb-4">
        <ArrowLeft size={15} /> Back to lessons
      </button>

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        {/* Quiet header — progress + steps recede so the content is the hero. */}
        <div className="h-[3px] bg-gray-100">
          <div className="h-full transition-all duration-500" style={{ width: `${((idx + 1) / total) * 100}%`, background: accent }} />
        </div>
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              <GraduationCap size={13} /> {module.skill?.name ?? module.title}
            </div>
            <div className="flex items-center gap-2.5">
              <span className="text-[11.5px] font-semibold text-gray-400 tabular-nums">{idx + 1} / {total}</span>
              <div className="flex items-center gap-1">
                {cards.map((_, i) => (
                  <button
                    key={i}
                    aria-label={`Go to step ${i + 1}`}
                    onClick={() => setCurrent(i)}
                    className="h-[5px] rounded-full transition-all"
                    style={{ width: i === idx ? 22 : 14, background: i === idx ? accent : i < idx ? '#c3ccd8' : '#e8eef5' }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg" style={{ color: accent, background: `${accent}22` }}>
              {node.icon}
            </span>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{section.heading}</h1>
          </div>
        </div>

        {/* Stage — one segment at a time. */}
        <div className="px-6 py-5 min-h-[240px]">
          {completed ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-green-50 text-brand-green">
                <Check size={30} />
              </div>
              <p className="text-lg font-bold text-gray-900">Lesson complete</p>
              <p className="mt-1 text-sm text-gray-500">Nice work — you got every question right.</p>
            </div>
          ) : (
            <>
              {/* W-135: a figure the current card references (of any kind) is shown right here on
                  EVERY card — teaching cards and the Guided Quiz — so students never jump back. */}
              {carriedFigure && <MarkdownView content={carriedFigure} components={withFigures()} />}
              {idx === 0 && intro ? (
                <div className="space-y-3">
                  <MarkdownView content={intro} components={withFigures()} />
                  {hasQuiz ? null : <SegmentBody section={section} />}
                </div>
              ) : hasQuiz ? (
                <div>
                  {prose && <MarkdownView content={prose} components={withFigures()} />}
                  <div className="mt-3 space-y-3">
                    {quizzes.map((q, i) => (
                      <LessonQuiz key={i} quiz={q} onSolved={() => setSolved((prev) => new Set(prev).add(i))} />
                    ))}
                  </div>
                  {!allSolved && (
                    <p className="mt-3 text-sm text-gray-500">
                      Answer every question correctly to finish — use <strong>Back</strong> to review a step.
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  {showMedia && <MediaStage kind={module.mediaKind} url={module.mediaUrl} svg={module.mediaSvg} />}
                  <SegmentBody section={section} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-5 py-3.5">
          <button
            onClick={() => setCurrent((c) => Math.max(0, c - 1))}
            disabled={idx === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-white disabled:invisible"
          >
            <ChevronLeft size={15} /> Back
          </button>
          {completed ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-green-50 px-4 py-2 text-sm font-semibold text-green-800">
              <Check size={15} /> Completed
            </span>
          ) : isLast ? (
            <button
              onClick={markComplete}
              disabled={completing || !allSolved}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-green px-5 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
            >
              <Check size={15} /> {completing ? 'Saving…' : 'Mark complete'}
            </button>
          ) : (
            <button
              onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-5 py-2 text-sm font-semibold text-white hover:brightness-95"
            >
              Next <ChevronRight size={15} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
