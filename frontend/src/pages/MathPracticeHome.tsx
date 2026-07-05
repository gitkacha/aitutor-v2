import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mathApi, MathTopic, MathAttempt } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Clock, Grid3x3 } from 'lucide-react';

export default function MathPracticeHome() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<MathTopic | null>(null);
  const [attempts, setAttempts] = useState<MathAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const isAllTopics = topicSlug === 'all-topics';

  useEffect(() => {
    if (!topicSlug) return;
    setLoading(true);

    if (isAllTopics) {
      mathApi.getAttempts().then(setAttempts).catch(() => {}).finally(() => setLoading(false));
      setTopic({
        id: 0,
        name: 'All Topics',
        slug: 'all-topics',
        description: 'A full 35-question Mathematical Reasoning test covering all 20 topic categories, just like the real Selective Trial Test.',
        isDemo: false,
      });
    } else {
      Promise.all([
        mathApi.getTopic(topicSlug),
        mathApi.getAttempts(topicSlug),
      ])
        .then(([t, a]) => {
          setTopic(t);
          setAttempts(a);
        })
        .catch(() => navigate('/dashboard'))
        .finally(() => setLoading(false));
    }
  }, [topicSlug, navigate, isAllTopics]);

  const averageScore = attempts.length > 0
    ? Math.round(
        attempts.reduce((sum, a) => sum + Math.round((a.score / a.totalQuestions) * 100), 0) / attempts.length
      )
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (!topic) {
    return <div className="text-center py-20 text-gray-500">Topic not found.</div>;
  }

  const questionCount = isAllTopics ? 35 : (topic.questions?.length || 10);
  const timeSeconds = Math.min(questionCount * 69, 2400); // 69s per Q, max 40min

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          {isAllTopics && <Grid3x3 size={24} className="text-brand-blue" />}
          <h1 className="text-3xl font-bold text-gray-900">{topic.name}</h1>
        </div>
        <p className="text-gray-600 mt-2">{topic.description}</p>
      </div>

      {/* Test info */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Test Format</h2>
        <ul className="mt-3 space-y-2 text-gray-700">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
            {questionCount} multiple-choice questions
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
            5 answer options per question (A-E)
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
            {Math.floor(timeSeconds / 60)} minutes time limit
          </li>
          {isAllTopics && (
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-amber" />
              Questions are drawn from all 20 topic categories
            </li>
          )}
        </ul>
      </div>

      {/* History summary */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your History</h2>
        {attempts.length === 0 ? (
          <p className="text-gray-400 mt-2">No attempts yet for this topic.</p>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-gray-700">
              <span className="font-medium">{attempts.length}</span> attempt{attempts.length !== 1 ? 's' : ''}
            </p>
            {averageScore !== null && (
              <p className="text-gray-700">
                Average score: <span className="font-semibold">{averageScore}%</span>
              </p>
            )}
            <div className="mt-3 space-y-2">
              {attempts.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/math-attempt/${a.id}`)}
                  className="flex items-center gap-2 text-sm text-brand-blue hover:underline"
                >
                  {new Date(a.finishedAt).toLocaleDateString()} — Score: {a.score}/{a.totalQuestions} ({Math.round((a.score / a.totalQuestions) * 100)}%)
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Start button */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => navigate(`/math/${topic.slug}/start`)}
      >
        <Clock className="mr-2" size={20} />
        Start Timed Practice
      </Button>
    </div>
  );
}