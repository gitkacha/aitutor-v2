import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mathApi, MathAttempt } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react';
import MathQuestionCard from '@/components/MathQuestionCard';

export default function MathAttemptReview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<MathAttempt | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const numId = parseInt(id);
    if (isNaN(numId)) return;
    mathApi.getAttempt(numId)
      .then(setAttempt)
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (!attempt) {
    return <div className="text-center py-20 text-gray-500">Attempt not found.</div>;
  }

  const questions = attempt.questionDetails || [];
  const answers = attempt.answersArray || [];
  const percentage = Math.round((attempt.score / attempt.totalQuestions) * 100);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Test Review</h1>
          <p className="text-sm text-gray-500">
            {attempt.topic?.name || 'All Topics'} · {new Date(attempt.finishedAt).toLocaleDateString('en-AU', {
              weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
            })}
          </p>
        </div>
      </div>

      {/* Score summary */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-gray-900">{percentage}%</div>
            <p className="text-sm text-gray-500 mt-1">Score</p>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-500" />
              <span className="text-gray-700">{attempt.score} correct</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <XCircle size={18} className="text-red-500" />
              <span className="text-gray-700">{attempt.totalQuestions - attempt.score} incorrect</span>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              Time taken: {formatTime(attempt.timeTaken)} · {attempt.totalQuestions} questions
            </p>
          </div>
          {attempt.breakdown && (
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">By Topic</p>
              {Object.entries(attempt.breakdown).slice(0, 5).map(([slug, data]) => (
                <p key={slug} className="text-xs text-gray-600 mt-1">
                  {slug.replace(/-/g, ' ')}: {data.correct}/{data.total}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Question-by-question review */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Question Review</h2>
        {questions.map((q, i) => {
          const studentAnswer = answers[i] ?? -1;
          const isCorrect = studentAnswer === q.correctIndex;
          let options: string[];
          try {
            options = JSON.parse(q.options);
          } catch {
            options = ['A', 'B', 'C', 'D', 'E'];
          }
          const labels = ['A', 'B', 'C', 'D', 'E'];

          return (
            <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className={`px-4 py-2 flex items-center gap-2 ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                {isCorrect ? (
                  <CheckCircle size={18} className="text-green-600" />
                ) : (
                  <XCircle size={18} className="text-red-500" />
                )}
                <span className={`text-sm font-medium ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                  Question {i + 1} — {isCorrect ? 'Correct' : 'Incorrect'}
                </span>
                <span className="text-xs text-gray-400 ml-auto">{q.topic?.name || ''}</span>
              </div>
              <div className="p-4">
                <MathQuestionCard
                  question={q}
                  selectedIndex={studentAnswer}
                  onSelect={() => {}}
                  showResult
                  correctIndex={q.correctIndex}
                />
                {/* Explanation */}
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Explanation</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{q.explanation}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}