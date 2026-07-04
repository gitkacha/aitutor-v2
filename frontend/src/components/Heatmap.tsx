import { useNavigate } from 'react-router-dom';
import { HeatmapEntry } from '@/lib/api';

interface HeatmapProps {
  data: HeatmapEntry[];
  onSelect?: (entry: HeatmapEntry) => void;
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

export default function Heatmap({ data, onSelect }: HeatmapProps) {
  const navigate = useNavigate();

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading heatmap data...</p>
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
            Start a timed practice for any text type to see your performance heatmap grow.
            Each text type gets a cell shaded by your average score.
          </p>
          <div className="flex justify-center gap-2 mt-8">
            {data.slice(0, 5).map((d) => (
              <button
                key={d.typeSlug}
                onClick={() => navigate(`/practice/${d.typeSlug}`)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-500 hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                {d.typeName}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-4">Click a text type above to start practising</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {data.map((entry) => (
        <button
          key={entry.typeSlug}
          onClick={() => {
            if (onSelect) {
              onSelect(entry);
            } else if (entry.attemptCount > 0) {
              navigate(`/history/${entry.typeSlug}`);
            } else {
              navigate(`/practice/${entry.typeSlug}`);
            }
          }}
          className={`rounded-xl p-4 text-left transition-all hover:scale-105 active:scale-95 ${getScoreColor(entry.averageScore)}`}
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
  );
}