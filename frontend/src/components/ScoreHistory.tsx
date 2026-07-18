import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, mathApi } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ScoreHistoryProps {
  subject?: 'writing' | 'math';
}

export default function ScoreHistory({ subject = 'writing' }: ScoreHistoryProps) {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeName, setTypeName] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const isMath = subject === 'math';

  useEffect(() => {
    if (!typeSlug) return;
    setLoading(true);
    setError(null);

    const load = isMath
      ? Promise.all([mathApi.getAttempts(typeSlug), mathApi.getTopic(typeSlug)]).then(
          ([atts, t]): [any[], string] => [atts, t.name]
        )
      : Promise.all([api.getAttempts(typeSlug), api.getType(typeSlug)]).then(
          ([atts, t]): [any[], string] => [atts.filter((a) => a.analysis), t.name]
        );

    load
      .then(([atts, name]) => {
        setAttempts(atts);
        setTypeName(name);
      })
      // A failed fetch is an error state, never the "no attempts yet" empty state (L4).
      .catch((e: any) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [typeSlug, isMath, retryToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 space-y-3">
        <p className="text-gray-700 font-medium">Couldn't load this history</p>
        <p className="text-sm text-gray-500">{error}</p>
        <Button onClick={() => setRetryToken((t) => t + 1)}>Try Again</Button>
      </div>
    );
  }

  const chartData = [...attempts]
    .reverse()
    .map((a: any) => ({
      date: new Date(a.finishedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      score: isMath ? Math.round((a.score / a.totalQuestions) * 100) : (a.analysis?.overallScore ?? 0),
      id: a.id,
    }));

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
          <ArrowLeft size={18} />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">{typeName} &mdash; Score History</h1>
      </div>

      {chartData.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No completed attempts with scores yet for this {isMath ? 'topic' : 'text type'}.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#9ca3af" fontSize={12} />
                <YAxis domain={[0, 100]} stroke="#9ca3af" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="var(--brand-blue)"
                  strokeWidth={2}
                  dot={{ r: 4, fill: 'var(--brand-blue)', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: 'var(--brand-blue)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {attempts.map((a: any) => (
              <button
                key={a.id}
                onClick={() => navigate(isMath ? `/math-attempt/${a.id}` : `/attempt/${a.id}`)}
                className="w-full bg-white rounded-lg p-4 border border-gray-200 text-left hover:border-brand-blue/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {new Date(a.finishedAt).toLocaleDateString('en-AU', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="font-semibold text-brand-blue">
                    {isMath
                      ? `Score: ${a.score}/${a.totalQuestions} (${Math.round((a.score / a.totalQuestions) * 100)}%)`
                      : `Score: ${a.analysis?.overallScore ?? 'Pending'}`}
                  </span>
                </div>
                {!isMath && a.text.length > 0 && (
                  <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                    {a.text.length > 100 ? `${a.text.slice(0, 100)}…` : a.text}
                  </p>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}