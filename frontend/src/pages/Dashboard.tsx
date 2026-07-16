import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import { HeatmapEntry, MathHeatmapEntry, mathApi } from '@/lib/api';
import Heatmap from '@/components/Heatmap';
import PendingWorksheets from '@/components/PendingWorksheets';
import { BarChart3, Calculator } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: writingData, loading: writingLoading, error: writingError } = useHeatmap();
  const [mathData, setMathData] = useState<MathHeatmapEntry[]>([]);
  const [mathLoading, setMathLoading] = useState(true);

  useEffect(() => {
    mathApi.getHeatmap()
      .then(setMathData)
      .catch(() => {})
      .finally(() => setMathLoading(false));
  }, []);

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

  if (writingLoading || mathLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (writingError) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">Failed to load data: {writingError}</p>
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

      {/* Writing Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={18} className="text-brand-blue" />
          <h2 className="text-lg font-semibold text-gray-900">Writing</h2>
        </div>
        <Heatmap data={writingData} onSelect={handleWritingSelect} />
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