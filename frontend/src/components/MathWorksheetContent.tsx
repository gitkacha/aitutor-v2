import { useEffect, useState } from 'react';
import { mathApi, MathQuestionFull } from '@/lib/api';
import MathQuestionCard from './MathQuestionCard';
import MathStimulusDisplay from './MathStimulusDisplay';

// Read-only view of a saved worksheet's questions (W-25): the admin can inspect the exact
// questions, correct answers, and explanations — for attempted or unattempted worksheets.
// Reuses the same rendering as the student's answer review.
export default function MathWorksheetContent({ worksheetId }: { worksheetId: number }) {
  const [questions, setQuestions] = useState<MathQuestionFull[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    mathApi.getQuestions({ worksheetId })
      .then((q) => { if (!cancelled) setQuestions(q); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [worksheetId]);

  if (error) return <p className="text-sm text-red-600">Couldn't load this worksheet: {error}</p>;
  if (!questions) return <p className="text-sm text-gray-400">Loading worksheet…</p>;
  if (questions.length === 0) return <p className="text-sm text-gray-400">This worksheet has no questions.</p>;

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="space-y-3">
          <p className="text-xs font-semibold text-gray-400">Question {i + 1}{q.topic?.name ? ` · ${q.topic.name}` : ''}</p>
          {q.stimulusGroup && <MathStimulusDisplay stimulus={q.stimulusGroup.stimulus} />}
          <MathQuestionCard question={q} selectedIndex={-1} onSelect={() => {}} showResult correctIndex={q.correctIndex} />
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Explanation</p>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{q.explanation}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
