import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Attempt } from '@/lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScoreHistory() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeName, setTypeName] = useState('');

  useEffect(() => {
    if (!typeSlug) return;
    Promise.all([
      api.getAttempts(typeSlug),
      api.getType(typeSlug),
    ])
      .then(([atts, t]) => {
        setAttempts(atts.filter((a) => a.analysis));
        setTypeName(t.name);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [typeSlug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  const chartData = [...attempts]
    .reverse()
    .map((a) => ({
      date: new Date(a.finishedAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }),
      score: a.analysis?.overallScore ?? 0,
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
          No completed attempts with scores yet for this text type.
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
            {attempts.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/attempt/${a.id}`)}
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
                    Score: {a.analysis?.overallScore ?? 'Pending'}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 line-clamp-1">{a.text.slice(0, 100)}...</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}