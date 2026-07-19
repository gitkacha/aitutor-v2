import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import { HeatmapEntry, MathHeatmapEntry, mathApi } from '@/lib/api';
import Heatmap from '@/components/Heatmap';
import PendingWorksheets from '@/components/PendingWorksheets';
import { BarChart3, Calculator, Target, ArrowRight } from 'lucide-react';

interface Opportunity {
  key: string;
  label: string;
  score: number;
  path: string;
}

// The student's weakest scored areas across both subjects (C2) — where a bit of practice
// moves the needle most. Only areas with attempts and a score qualify.
function opportunityAreas(writing: HeatmapEntry[], math: MathHeatmapEntry[]): Opportunity[] {
  const w: Opportunity[] = writing
    .filter((d) => d.attemptCount > 0 && d.averageScore != null)
    .map((d) => ({ key: `w-${d.typeSlug}`, label: d.typeName, score: d.averageScore!, path: `/practice/${d.typeSlug}` }));
  const m: Opportunity[] = math
    .filter((d) => d.attemptCount > 0 && d.averageScore != null)
    .map((d) => ({ key: `m-${d.topicSlug}`, label: d.topicName, score: d.averageScore!, path: `/math/${d.topicSlug}` }));
  return [...w, ...m].sort((a, b) => a.score - b.score).slice(0, 4);
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: writingData, loading: writingLoading, error: writingError, refresh: refreshWriting } = useHeatmap();
  const [mathData, setMathData] = useState<MathHeatmapEntry[]>([]);
  const [mathLoading, setMathLoading] = useState(true);
  const [mathError, setMathError] = useState<string | null>(null);

  const loadMath = () => {
    setMathLoading(true);
    setMathError(null);
    mathApi.getHeatmap()
      .then(setMathData)
      .catch((e) => setMathError(e.message))
      .finally(() => setMathLoading(false));
  };

  useEffect(loadMath, []);

  const handleWritingSelect = (entry: HeatmapEntry) => {
    if (entry.attemptCount > 0) {
      navigate(`/history/${entry.typeSlug}`);
    } else {
      navigate(`/practice/${entry.typeSlug}`);
    }
  };

  const handleMathSelect = (entry: MathHeatmapEntry) => {
    if (entry.attemptCount > 0) {
      navigate(`/math-history/${entry.topicSlug}`);
    } else {
      navigate(`/math/${entry.topicSlug}`);
    }
  };

  if (writingLoading && mathLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-brand-blue" />
        <h1 className="text-2xl font-bold text-gray-900">Progress Dashboard</h1>
      </div>

      {/* Pending worksheets quick view */}
      <PendingWorksheets mode="student" />

      {/* Opportunity areas — the student's weakest scored areas (C2) */}
      {(() => {
        const areas = opportunityAreas(writingData, mathData);
        if (areas.length === 0) return null;
        return (
          <section className="bg-white rounded-xl p-6 border border-gray-200">
            <div className="flex items-center gap-2 mb-1">
              <Target size={18} className="text-brand-amber" />
              <h2 className="text-lg font-semibold text-gray-900">Opportunity Areas</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Where a little more practice will help most, based on your scores so far.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {areas.map((a) => (
                <button
                  key={a.key}
                  onClick={() => navigate(a.path)}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-gray-100 hover:border-brand-blue/50 hover:bg-gray-50 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{a.label}</p>
                    <p className="text-xs text-gray-400">Current average: {a.score}%</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-medium text-brand-blue shrink-0">
                    Practice <ArrowRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Writing Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-brand-blue" />
          <h2 className="text-lg font-semibold text-gray-900">Writing</h2>
        </div>
        <Heatmap
          data={writingData}
          onSelect={handleWritingSelect}
          loading={writingLoading}
          error={writingError}
          onRetry={refreshWriting}
        />
      </div>

      {/* Mathematics Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calculator size={18} className="text-brand-blue" />
          <h2 className="text-lg font-semibold text-gray-900">Mathematics</h2>
        </div>
        <Heatmap
          data={mathData.map(d => ({
            typeId: d.topicId,
            typeName: d.topicName,
            typeSlug: d.topicSlug,
            averageScore: d.averageScore,
            attemptCount: d.attemptCount,
          }))}
          onSelect={(entry) => handleMathSelect({
            topicId: entry.typeId,
            topicName: entry.typeName,
            topicSlug: entry.typeSlug,
            averageScore: entry.averageScore,
            attemptCount: entry.attemptCount,
          })}
          basePath="math"
          loading={mathLoading}
          error={mathError}
          onRetry={loadMath}
        />
      </div>

      {/* Legend */}
      {(writingData.some(d => d.attemptCount > 0) || mathData.some(d => d.attemptCount > 0)) && (
        <div className="flex items-center gap-4 text-sm text-gray-500 justify-center">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-500 inline-block" />
            <span>0-19</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-400 inline-block" />
            <span>20-39</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-400 inline-block" />
            <span>40-59</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-400 inline-block" />
            <span>60-79</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-600 inline-block" />
            <span>80-100</span>
          </div>
        </div>
      )}
    </div>
  );
}