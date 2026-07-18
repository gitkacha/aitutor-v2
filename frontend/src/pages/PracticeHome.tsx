import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, WritingType, Attempt, Worksheet } from '@/lib/api';
import { worksheetStartState } from '@/lib/worksheet-start';
import { parseJsonArray } from '@/lib/parse';
import { Button } from '@/components/ui/button';
import { Clock, ArrowRight, FileText } from 'lucide-react';

export default function PracticeHome() {
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const navigate = useNavigate();
  const [type, setType] = useState<WritingType | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [worksheets, setWorksheets] = useState<Worksheet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!typeSlug) return;
    Promise.all([
      api.getType(typeSlug),
      api.getAttempts(typeSlug),
      api.getWorksheets(),
    ])
      .then(([t, a, ws]) => {
        setType(t);
        setAttempts(a);
        // Filter worksheets that match this type
        setWorksheets(ws.filter(w => w.typeId === t.id));
      })
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [typeSlug, navigate]);

  // Average only analysed attempts — a pending or failed analysis is not a zero (M8).
  const scoredAttempts = attempts.filter((a) => a.analysis?.overallScore != null);
  const averageScore = scoredAttempts.length > 0
    ? Math.round(
        scoredAttempts.reduce((sum, a) => sum + a.analysis!.overallScore, 0) / scoredAttempts.length
      )
    : null;

  const handleStartWorksheet = (worksheet: Worksheet) => {
    if (!type) return;
    navigate(`/practice/${type.slug}/start`, { state: worksheetStartState(type, worksheet) });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (!type) {
    return <div className="text-center py-20 text-gray-500">Writing type not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{type.name}</h1>
        <p className="text-gray-600 mt-2">{type.description}</p>
      </div>

      {/* Expected structure */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Expected Structure</h2>
        <p className="text-gray-700 mt-2">{type.expectedStructure}</p>
      </div>

      {/* History summary */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Your History</h2>
        {attempts.length === 0 ? (
          <p className="text-gray-400 mt-2">No attempts yet for this text type.</p>
        ) : (
          <div className="mt-2 space-y-1">
            <p className="text-gray-700">
              <span className="font-medium">{attempts.length}</span> attempt{attempts.length !== 1 ? 's' : ''}
            </p>
            {averageScore !== null && (
              <p className="text-gray-700">
                Average score: <span className="font-semibold">{averageScore}/100</span>
              </p>
            )}
            <div className="mt-3 space-y-2">
              {attempts.slice(0, 5).map((a) => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/attempt/${a.id}`)}
                  className="flex items-center gap-2 text-sm text-brand-blue hover:underline"
                >
                  {new Date(a.finishedAt).toLocaleDateString()} — Score: {a.analysis?.overallScore ?? 'Pending'}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Available Worksheets */}
      {worksheets.length > 0 && (
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Available Worksheets</h2>
          <div className="space-y-3">
            {worksheets.map((ws) => {
              const prompts = parseJsonArray<string>(ws.prompts);
              const promptText = prompts[0] || '';
              return (
                <div key={ws.id} className="border border-brand-blue/20 rounded-lg p-4 bg-brand-blue/5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 mr-4">
                      <p className="text-sm font-semibold text-gray-900">{ws.title}</p>
                      <p className="text-xs text-gray-400 mt-1">Created {new Date(ws.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{promptText}</p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 mt-1"
                      onClick={() => handleStartWorksheet(ws)}
                    >
                      <FileText size={14} className="mr-1" />
                      Start
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Start regular practice button */}
      <Button
        size="lg"
        className="w-full"
        onClick={() => {
          const randomPrompt = type.prompts?.[Math.floor(Math.random() * (type.prompts?.length || 1))];
          if (randomPrompt) {
            navigate(`/practice/${type.slug}/start`, {
              state: { prompt: randomPrompt, type },
            });
          }
        }}
      >
        <Clock className="mr-2" size={20} />
        Start Timed Practice
      </Button>
    </div>
  );
}