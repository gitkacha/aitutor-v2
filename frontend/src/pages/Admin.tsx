import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import { api, mathApi, MathTopic, MathHeatmapEntry, GeneratedMathQuestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Database, Trash2, Calculator } from 'lucide-react';

type AdminTab = 'writing' | 'math';

export default function Admin() {
  const navigate = useNavigate();
  const { data: writingHeatmap, refresh: refreshWriting } = useHeatmap();
  const [mathHeatmap, setMathHeatmap] = useState<MathHeatmapEntry[]>([]);
  const [mathTopics, setMathTopics] = useState<MathTopic[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('writing');
  const [generating, setGenerating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Math worksheet state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedMathQuestion[]>([]);
  const [showReview, setShowReview] = useState(false);

  useEffect(() => {
    if (activeTab === 'math') {
      mathApi.getHeatmap().then(setMathHeatmap).catch(() => {});
      mathApi.getTopics().then(setMathTopics).catch(() => {});
    }
  }, [activeTab]);

  const refreshMath = () => {
    mathApi.getHeatmap().then(setMathHeatmap).catch(() => {});
  };

  // Writing worksheet
  const handleGenerateWriting = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const withScores = writingHeatmap
        .filter((d) => d.averageScore !== null)
        .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
      const targetTypes = withScores.length > 0
        ? [withScores[0].typeId]
        : writingHeatmap.slice(0, 2).map((d) => d.typeId);
      const worksheet = await api.generateWorksheet(targetTypes);
      setMessage(`Writing worksheet "${worksheet.title}" generated!`);
      refreshWriting();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Math worksheet generation
  const handleGenerateMath = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await mathApi.generateWorksheet(selectedTopics);
      setGeneratedQuestions(result.questions);
      setShowReview(true);
      setMessage(`Generated ${result.questions.length} questions across ${result.topics.length} topic(s).`);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveWorksheet = async () => {
    setMessage(null);
    try {
      const title = `Worksheet: ${selectedTopics.length === 0 ? 'All Topics' : selectedTopics.join(', ')}`;
      await mathApi.saveWorksheet(title, selectedTopics, generatedQuestions);
      setShowReview(false);
      setGeneratedQuestions([]);
      setMessage(`Worksheet "${title}" saved successfully!`);
      refreshMath();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  // Demo data
  const handleLoadDemo = async () => {
    setDemoLoading(true);
    setMessage(null);
    try {
      const result = await api.loadDemo();
      setMessage(result.message);
      refreshWriting();
      refreshMath();
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
      refreshWriting();
      refreshMath();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setDemoLoading(false);
    }
  };

  const toggleTopic = (slug: string) => {
    setSelectedTopics(prev =>
      prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]
    );
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

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setActiveTab('writing')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'writing' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Writing
        </button>
        <button
          onClick={() => setActiveTab('math')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'math' ? 'bg-white text-brand-blue shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <Calculator className="inline mr-1" size={14} />
          Mathematics
        </button>
      </div>

      {activeTab === 'writing' ? (
        <>
          {/* Writing Heatmap */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Writing Performance</h2>
            <Heatmap
              data={writingHeatmap}
              onSelect={(entry) => navigate(`/history/${entry.typeSlug}`)}
            />
          </div>

          {/* Writing Worksheet */}
          <div className="bg-white rounded-xl p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Writing Worksheet</h2>
            <p className="text-sm text-gray-500 mb-4">
              Generate an AI-assisted worksheet targeting the weakest text types.
            </p>
            <Button onClick={handleGenerateWriting} disabled={generating}>
              <Plus className="mr-2" size={18} />
              {generating ? 'Generating...' : 'Generate Worksheet'}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Math Heatmap */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Mathematics Performance</h2>
            <Heatmap
              data={mathHeatmap.map(d => ({
                typeId: d.topicId,
                typeName: d.topicName,
                typeSlug: d.topicSlug,
                averageScore: d.averageScore,
                attemptCount: d.attemptCount,
              }))}
              onSelect={(entry) => navigate(`/math-history/${entry.typeSlug}`)}
            />
          </div>

          {/* Math Worksheet Generation */}
          {!showReview ? (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Mathematics Worksheet</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select one or more topics, or leave empty for all topics. Generates 35 multiple-choice questions at or above the difficulty of the reference test.
              </p>

              {/* Topic selector */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setSelectedTopics([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedTopics.length === 0
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'border-gray-200 text-gray-600 hover:border-brand-blue'
                    }`}
                  >
                    All Topics (auto)
                  </button>
                  <span className="text-xs text-gray-400">or select specific topics:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {mathTopics.map((topic) => {
                    const heatEntry = mathHeatmap.find(h => h.topicSlug === topic.slug);
                    return (
                      <button
                        key={topic.slug}
                        onClick={() => toggleTopic(topic.slug)}
                        className={`px-3 py-2 rounded-lg text-xs border text-left transition-colors ${
                          selectedTopics.includes(topic.slug)
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                            : 'border-gray-200 text-gray-600 hover:border-brand-blue'
                        }`}
                      >
                        <div className="font-medium">{topic.name}</div>
                        {heatEntry && (
                          <div className="text-gray-400 mt-0.5">
                            {heatEntry.averageScore !== null ? `${heatEntry.averageScore}%` : '—'} · {heatEntry.attemptCount} att.
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Button onClick={handleGenerateMath} disabled={generating}>
                <Plus className="mr-2" size={18} />
                {generating ? 'Generating 35 Questions...' : 'Generate 35-Question Worksheet'}
              </Button>
            </div>
          ) : (
            /* Review generated questions */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Review Generated Questions</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowReview(false); setGeneratedQuestions([]); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveWorksheet}>
                    Save Worksheet
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {generatedQuestions.length} questions generated. Review and save to make them available to the student.
              </p>
              {generatedQuestions.map((q, i) => {
                const labels = ['A', 'B', 'C', 'D', 'E'];
                return (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-400 shrink-0 mt-0.5">Q{i + 1}.</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 font-medium whitespace-pre-line">{q.questionText}</p>
                        <div className="mt-2 space-y-1">
                          {q.options.map((opt, oi) => (
                            <div key={oi} className={`text-xs px-2 py-1 rounded ${oi === q.correctIndex ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-500'}`}>
                              {labels[oi]}: {opt} {oi === q.correctIndex && '✓'}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          <span className="font-medium">Topic:</span> {q.topicName} · <span className="font-medium">Explanation:</span> {q.explanation}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Demo data controls (always visible) */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Demo Data</h2>
        <p className="text-sm text-gray-500 mb-4">
          Load demo data to populate the app with sample attempts, analyses, and worksheets for both Writing and Mathematics.
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