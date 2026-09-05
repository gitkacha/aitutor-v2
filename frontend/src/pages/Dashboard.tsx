import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import { HeatmapEntry, MathHeatmapEntry, mathApi } from '@/lib/api';
import Heatmap from '@/components/Heatmap';
import PendingWorksheets from '@/components/PendingWorksheets';
import MostImproved from '@/components/MostImproved';
import { BarChart3, Calculator, Target, ArrowRight } from 'lucide-react';
import { opportunityAreas } from '@/lib/opportunity';

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

  // Thinking Skills heatmap (W-98) — its own section, separate from Mathematics.
  const [thinkingData, setThinkingData] = useState<MathHeatmapEntry[]>([]);
  const [thinkingLoading, setThinkingLoading] = useState(true);
  const [thinkingError, setThinkingError] = useState<string | null>(null);
  const loadThinking = () => {
    setThinkingLoading(true);
    setThinkingError(null);
    mathApi.getHeatmap(undefined, 'thinking-skills')
      .then(setThinkingData)
      .catch((e) => setThinkingError(e.message))
      .finally(() => setThinkingLoading(false));
  };
  useEffect(loadThinking, []);

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

      {/* Most Improved — recent accuracy/speed gains (M3c-1 Task 4) */}
      <MostImproved />

      {/* Opportunity areas — the student's weakest scored areas (C2) */}
      {(() => {
        const areas = opportunityAreas(writingData, mathData, thinkingData);
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

      {/* Thinking Skills Section (W-98) */}
      {(thinkingLoading || thinkingError || thinkingData.length > 0) && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calculator size={18} className="text-brand-amber" />
            <h2 className="text-lg font-semibold text-gray-900">Thinking Skills</h2>
          </div>
          <Heatmap
            data={thinkingData.map(d => ({
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
            loading={thinkingLoading}
            error={thinkingError}
            onRetry={loadThinking}
          />
        </div>
      )}

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