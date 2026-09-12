import { useState } from 'react';
import { CheckCircle2, HelpCircle } from 'lucide-react';
import { checkAnswer } from '@/lib/quizAnswer';
import { validateStimulus, type Figure } from '@/lib/stimulus';
import MarkdownView from './MarkdownView';
import StimulusFigure from './StimulusFigure';

// W-120: one interactive Guided-Quiz question, embedded in a lesson via a ```quiz block. The hint
// nudges the student to apply the speed trick (with blanks, not the numbers); the worked solution is
// hidden until they answer correctly or click "Show me". Client-only — a learning aid, not scored.
// NOTE: this file must NOT import from lessonFigureComponents (that module imports this one — keeping
// the dependency one-way avoids a cycle). The revealed solution renders with a plain MarkdownView.

export interface QuizQuestion {
  question: string;
  hint?: string;
  answer: string;
  acceptable?: string[];
  solution?: string;
  figure?: Figure; // W-136: a small diagram specific to THIS question (validated).
}

// Validate an optional per-question figure the same way inline ```figure blocks are validated.
function parseQuizFigure(raw: unknown): Figure | undefined {
  return raw && typeof raw === 'object' && validateStimulus({ version: 1, figures: [raw] })
    ? (raw as Figure)
    : undefined;
}

// Parse a ```quiz block body into a QuizQuestion, or null if it isn't one.
export function parseQuiz(raw: string): QuizQuestion | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    const o = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof o.question !== 'string' || typeof o.answer !== 'string') return null;
    return {
      question: o.question,
      answer: o.answer,
      hint: typeof o.hint === 'string' ? o.hint : undefined,
      acceptable: Array.isArray(o.acceptable) ? o.acceptable.filter((x): x is string => typeof x === 'string') : undefined,
      solution: typeof o.solution === 'string' ? o.solution : undefined,
      figure: parseQuizFigure(o.figure),
    };
  } catch {
    return null;
  }
}

export default function LessonQuiz({ quiz, onSolved }: { quiz: QuizQuestion; onSolved?: () => void }) {
  const [value, setValue] = useState('');
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [revealed, setRevealed] = useState(false);

  function check() {
    if (!value.trim()) return;
    if (checkAnswer(value, quiz.answer, quiz.acceptable)) {
      setStatus('correct');
      setRevealed(true);
      onSolved?.(); // W-125: lets the gated quiz card track how many are solved correctly.
    } else {
      setStatus('wrong');
    }
  }

  return (
    <div className="my-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[15px] font-medium text-gray-900">{quiz.question}</p>
      {quiz.figure && (
        // A plain block wrapper (not flex): StimulusFigure's own wrapper is a block-level
        // `flex justify-center` that spans this box's full width and centres the figure. Making
        // THIS a flex container instead would shrink-wrap the figure — collapsing width-100% charts
        // (bar/line) to their title width so ResponsiveContainer has no room to draw (W-136).
        <div className="mt-2 rounded-lg bg-gray-50/70 p-2">
          <StimulusFigure figure={quiz.figure} interactive compact />
        </div>
      )}
      {quiz.hint && (
        <p className="mt-1.5 flex items-start gap-1.5 text-sm text-gray-500">
          <HelpCircle size={15} className="mt-0.5 shrink-0 text-brand-blue" />
          <span>{quiz.hint}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (status === 'wrong') setStatus('idle');
          }}
          onKeyDown={(e) => e.key === 'Enter' && check()}
          placeholder="Your answer"
          aria-label="Your answer"
          disabled={status === 'correct'}
          className="w-40 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-blue focus:outline-none disabled:bg-gray-50"
        />
        <button
          onClick={check}
          disabled={status === 'correct'}
          className="rounded-lg bg-brand-blue px-3 py-1.5 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-50"
        >
          Check
        </button>
        {!revealed && (
          <button onClick={() => setRevealed(true)} className="text-sm font-medium text-gray-400 hover:text-gray-600">
            Show me
          </button>
        )}
      </div>

      {status === 'correct' && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-green">
          <CheckCircle2 size={15} /> Nice — that's it!
        </p>
      )}
      {status === 'wrong' && (
        <p className="mt-2 text-sm font-medium text-amber-700">Not quite — try again.</p>
      )}

      {revealed && quiz.solution && (
        <div className="mt-3 rounded-lg bg-green-50 p-3">
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-green-800">Speed solution</div>
          <div className="text-green-900">
            <MarkdownView content={quiz.solution} />
          </div>
        </div>
      )}
    </div>
  );
}
