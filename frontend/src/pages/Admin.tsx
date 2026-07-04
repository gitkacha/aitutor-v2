import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Database, Trash2 } from 'lucide-react';

export default function Admin() {
  const navigate = useNavigate();
  const { data: heatmapData, refresh: refreshHeatmap } = useHeatmap();
  const [generating, setGenerating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleGenerateWorksheet = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      // Find weakest types (lowest scores)
      const withScores = heatmapData
        .filter((d) => d.averageScore !== null)
        .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));

      const targetTypes = withScores.length > 0
        ? [withScores[0].typeId]
        : heatmapData.slice(0, 2).map((d) => d.typeId);

      const worksheet = await api.generateWorksheet(targetTypes);
      setMessage(`Worksheet "${worksheet.title}" generated! Check the worksheets list below.`);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setMessage(null);
    try {
      const result = await api.loadDemo();
      setMessage(result.message);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoLoading(true);
    setMessage(null);
    try {
      const result = await api.clearDemo();
      setMessage(result.message);
      refreshHeatmap();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Shield size={24} className="text-brand-amber" />
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-brand-amber/10 border border-brand-amber/30 rounded-xl p-4 text-sm text-gray-700">
          {message}
        </div>
      )}

      {/* Heatmap section */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Student Performance</h2>
        <Heatmap
          data={heatmapData}
          onSelect={(entry) => navigate(`/history/${entry.typeSlug}`)}
        />
      </div>

      {/* Worksheet generation */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Worksheet</h2>
        <p className="text-sm text-gray-500 mb-4">
          Generate an AI-assisted worksheet targeting the weakest text types from the heatmap above.
        </p>
        <Button onClick={handleGenerateWorksheet} disabled={generating}>
          <Plus className="mr-2" size={18} />
          {generating ? 'Generating...' : 'Generate Worksheet'}
        </Button>
      </div>

      {/* Demo data controls */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Demo Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Load demo data to populate the app with sample attempts, analyses, and worksheets for demonstration purposes.
          Clear demo data removes only the seeded records, leaving any real student work untouched.
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleLoadDemo} disabled={demoLoading}>
            <Database className="mr-2" size={18} />
            {demoLoading ? 'Loading...' : 'Load Demo Data'}
          </Button>
          <Button variant="outline" onClick={handleClearDemo} disabled={demoLoading}>
            <Trash2 className="mr-2" size={18} />
            {demoLoading ? 'Clearing...' : 'Clear Demo Data'}
          </Button>
        </div>
      </div>
    </div>
  );
}