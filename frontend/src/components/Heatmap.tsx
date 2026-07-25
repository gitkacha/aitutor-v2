import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HeatmapEntry } from '@/lib/api';

// M3b-2 Task 6: when `drill` is supplied (admin math view only), clicking a topic cell reveals its
// skills below the grid instead of navigating — the topic heatmap, one level deeper.
export interface DrillSkill {
  slug: string;
  name: string;
  accuracy: number | null;
  attempted: number;
}

interface HeatmapProps {
  data: HeatmapEntry[];
  onSelect?: (entry: HeatmapEntry) => void;
  basePath?: string; // 'math' for math topics, undefined for writing
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  drill?: (topicSlug: string) => DrillSkill[];
}

function skillColor(accuracy: number | null, attempted: number): string {
  if (attempted < 8) return 'bg-gray-400 text-white';
  if (accuracy === null) return 'bg-gray-400 text-white';
  const s = accuracy * 100;
  if (s >= 80) return 'bg-green-600 text-white';
  if (s >= 60) return 'bg-green-400 text-white';
  if (s >= 40) return 'bg-yellow-400 text-gray-800';
  if (s >= 20) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function getScoreColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-400';
  if (score >= 80) return 'bg-green-600 text-white';
  if (score >= 60) return 'bg-green-400 text-white';
  if (score >= 40) return 'bg-yellow-400 text-gray-800';
  if (score >= 20) return 'bg-orange-400 text-white';
  return 'bg-red-500 text-white';
}

function getScoreLabel(score: number | null): string {
  if (score === null) return '—';
  return `${score}`;
}

export default function Heatmap({ data, onSelect, basePath, loading, error, onRetry, drill }: HeatmapProps) {
  const navigate = useNavigate();
  const prefix = basePath ? `/${basePath}` : '';
  const [drilledSlug, setDrilledSlug] = useState<string | null>(null);

  // Loading and error are distinct states (M5) — a failed fetch must never look like
  // an eternal load.
  if (error) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-gray-700 font-medium">Couldn't load this heatmap</p>
        <p className="text-sm text-gray-500">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-lg bg-brand-blue text-white text-sm font-medium hover:bg-brand-blue/90"
          >
            Try Again
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading heatmap data...</p>
      </div>
    );
  }

  // A successful-but-empty response is "no data", never an eternal load (L6).
  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No heatmap data available.</p>
      </div>
    );
  }

  const allEmpty = data.every((d) => d.attemptCount === 0);

  if (allEmpty) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="bg-white rounded-2xl p-12 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">Your progress will appear here</h2>
          <p className="text-gray-500 mt-3 max-w-md mx-auto">
            Start a timed practice to see your performance heatmap grow.
            Each {basePath ? 'topic' : 'text type'} gets a cell shaded by your average score.
          </p>
          <div className="flex justify-center gap-2 mt-8">
            {data.slice(0, 5).map((d) => (
              <button
                key={d.typeSlug}
                onClick={() => navigate(`${prefix}/${d.typeSlug}`)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                {d.typeName}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Click a {basePath ? 'topic' : 'text type'} above to start practising</p>
        </div>
      </div>
    );
  }

  const drilledSkills = drill && drilledSlug ? drill(drilledSlug) : null;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {data.map((entry) => (
          <button
            key={entry.typeSlug}
            onClick={() => {
              if (drill) {
                setDrilledSlug((cur) => (cur === entry.typeSlug ? null : entry.typeSlug));
              } else if (onSelect) {
                onSelect(entry);
              } else if (entry.attemptCount > 0) {
                navigate(basePath ? `/math-history/${entry.typeSlug}` : `/history/${entry.typeSlug}`);
              } else {
                navigate(basePath ? `/math/${entry.typeSlug}` : `/practice/${entry.typeSlug}`);
              }
            }}
            className={`rounded-xl p-4 text-left transition-all hover:scale-105 active:scale-95 ${getScoreColor(entry.averageScore)} ${drill && drilledSlug === entry.typeSlug ? 'ring-2 ring-brand-blue ring-offset-2' : ''}`}
            title={`${entry.typeName}: ${entry.attemptCount} attempt${entry.attemptCount !== 1 ? 's' : ''}`}
          >
            <div className="text-sm font-medium">{entry.typeName}</div>
            <div className="text-2xl font-bold mt-1">{getScoreLabel(entry.averageScore)}</div>
            <div className="text-xs mt-1 opacity-70">
              {entry.attemptCount} attempt{entry.attemptCount !== 1 ? 's' : ''}
            </div>
          </button>
        ))}
      </div>

      {drilledSkills && (
        <div data-testid="heatmap-skill-drill" className="mt-3 rounded-xl border border-gray-200 bg-white p-3.5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-2">
            {data.find((d) => d.typeSlug === drilledSlug)?.typeName} · skills
          </p>
          {drilledSkills.length === 0 ? (
            <p className="text-sm text-gray-400">No skills for this topic.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {drilledSkills.map((s) => (
                <span key={s.slug} className={`text-xs font-semibold rounded-lg px-2.5 py-1.5 ${skillColor(s.accuracy, s.attempted)}`}>
                  {s.name} {s.attempted < 8 ? `${s.attempted} Q` : `${Math.round((s.accuracy ?? 0) * 100)}%`}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}