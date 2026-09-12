import type { Components } from 'react-markdown';
import { validateStimulus, type Figure } from '@/lib/stimulus';
import StimulusFigure from './StimulusFigure';
import LessonQuiz, { parseQuiz } from './LessonQuiz';

// Render interactive blocks inside coaching lessons. A lesson embeds them as fenced code blocks:
//   ```figure    — one figure JSON object, rendered by the MCQ stimulus engine (W-114)
//   ```quiz      — one interactive Guided-Quiz question (W-120)
//
// These overrides are OPT-IN — only the lesson render sites (student Lesson page, admin ModuleEditor
// preview) pass them, so all other markdown (and the shared MarkdownView defaults) are untouched.
// A block that isn't valid JSON falls back to the normal inline code rendering, so a garbled block
// degrades to readable text rather than crashing.

function codeText(children: React.ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(codeText).join('');
  return '';
}

// Parse a ```figure block body into a validated Figure, or null if it isn't one.
function parseFigure(raw: string): Figure | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const obj = JSON.parse(trimmed);
    // Reuse the exported validator by wrapping the figure in a one-figure spec.
    if (validateStimulus({ version: 1, figures: [obj] })) return obj as Figure;
    return null;
  } catch {
    return null;
  }
}

export const figureComponents: Components = {
  // Block figures are rendered by `code`; react-markdown nests fenced code in a <pre>, so pass the
  // <pre> through unchanged (the figure card is already a block element).
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    if (className && /\blanguage-figure\b/.test(className)) {
      const figure = parseFigure(codeText(children));
      if (figure) {
        return (
          <div className="my-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3">
            {/* W-130: lesson figures are interactive (hover-to-explain). MCQ/test figures are not. */}
            <StimulusFigure figure={figure} interactive />
          </div>
        );
      }
    }
    if (className && /\blanguage-quiz\b/.test(className)) {
      const quiz = parseQuiz(codeText(children));
      if (quiz) return <LessonQuiz quiz={quiz} />;
    }
    // Default: match MarkdownView's inline code chip.
    return <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-gray-900">{children}</code>;
  },
};

// Merge the lesson-block overrides with any caller-supplied component overrides. Block handling
// always wins for `code`/`pre` so embedded figures/quizzes render regardless of the caller's other
// overrides. (Named `withFigures` for historical reasons; it now covers all lesson blocks.)
export function withFigures(extra?: Components): Components {
  return { ...extra, ...figureComponents };
}
