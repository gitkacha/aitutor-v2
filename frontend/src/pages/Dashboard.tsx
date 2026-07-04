import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import { BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { data, loading, error } = useHeatmap();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">Failed to load data: {error}</p>
      </div>
    );
  }

  const handleSelect = (slug: string) => {
    navigate(`/practice/${slug}`);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 size={24} className="text-brand-blue" />
        <h1 className="text-2xl font-bold text-gray-900">Progress Dashboard</h1>
      </div>

      <p className="text-gray-500">
        Your performance across all text types. Click any cell to see your score history for that type.
      </p>

      <Heatmap data={data} onSelect={handleSelect} />

      {data.some((d) => d.attemptCount > 0) && (
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