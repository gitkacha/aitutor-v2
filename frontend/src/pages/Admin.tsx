import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHeatmap } from '@/hooks/useHeatmap';
import Heatmap from '@/components/Heatmap';
import PendingWorksheets from '@/components/PendingWorksheets';
import { api, mathApi, MathTopic, MathHeatmapEntry, GeneratedMathQuestion, Worksheet, MathWorksheet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Shield, Plus, Database, Trash2, Calculator, FileText } from 'lucide-react';
import StimulusFigure from '@/components/StimulusFigure';
import { validateStimulus } from '@/lib/stimulus';
import { parseJsonArray } from '@/lib/parse';
import { mathWorksheetTitle } from '@/lib/math-worksheet-title';

type AdminTab = 'writing' | 'math';

interface WritingTypeBrief {
  id: number;
  name: string;
  slug: string;
}

export default function Admin() {
  const navigate = useNavigate();
  const { data: writingHeatmap, loading: writingHeatmapLoading, error: writingHeatmapError, refresh: refreshWriting } = useHeatmap();
  const [mathHeatmapError, setMathHeatmapError] = useState<string | null>(null);
  // Starts true so the math tab's first paint shows "loading", not a no-data flash (L6).
  const [mathHeatmapLoading, setMathHeatmapLoading] = useState(true);
  const [writingTypes, setWritingTypes] = useState<WritingTypeBrief[]>([]);
  const [mathHeatmap, setMathHeatmap] = useState<MathHeatmapEntry[]>([]);
  const [mathTopics, setMathTopics] = useState<MathTopic[]>([]);
  const [activeTab, setActiveTab] = useState<AdminTab>('writing');
  const [generating, setGenerating] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [worksheetRefresh, setWorksheetRefresh] = useState(0);

  // Writing worksheet state
  const [selectedWritingTypes, setSelectedWritingTypes] = useState<number[]>([]);
  const [generatedPrompts, setGeneratedPrompts] = useState<string[]>([]);
  const [generatedTypeInfo, setGeneratedTypeInfo] = useState<WritingTypeBrief[]>([]);
  const [showWritingReview, setShowWritingReview] = useState(false);

  // Math worksheet state
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(35);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedMathQuestion[]>([]);
  const [showMathReview, setShowMathReview] = useState(false);

  // Saved worksheets lists
  const [writingWorksheets, setWritingWorksheets] = useState<Worksheet[]>([]);
  const [mathWorksheets, setMathWorksheets] = useState<MathWorksheet[]>([]);

  useEffect(() => {
    if (activeTab === 'writing') {
      api.getTypes().then(setWritingTypes).catch(() => {});
      api.getWorksheets().then(setWritingWorksheets).catch(() => {});
    } else if (activeTab === 'math') {
      refreshMath();
      mathApi.getTopics().then(setMathTopics).catch(() => {});
      mathApi.getWorksheets().then(setMathWorksheets).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const refreshMath = () => {
    setMathHeatmapError(null);
    setMathHeatmapLoading(true);
    mathApi.getHeatmap()
      .then(setMathHeatmap)
      .catch((e) => setMathHeatmapError(e.message))
      .finally(() => setMathHeatmapLoading(false));
  };

  // Writing worksheet generation
  const handleGenerateWriting = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      let typeIds = selectedWritingTypes;
      if (typeIds.length === 0) {
        // Auto-select weakest type(s) from heatmap
        const withScores = writingHeatmap
          .filter((d) => d.averageScore !== null)
          .sort((a, b) => (a.averageScore || 0) - (b.averageScore || 0));
        typeIds = withScores.length > 0
          ? [withScores[0].typeId]
          : writingHeatmap.slice(0, 2).map((d) => d.typeId);
      }
      const result = await api.generateWorksheet(typeIds);
      setGeneratedPrompts(result.prompts);
      setGeneratedTypeInfo(result.types);
      setShowWritingReview(true);
      setMessage(`Generated ${result.prompts.length} writing prompts.`);
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveWritingWorksheet = async () => {
    setMessage(null);
    try {
      const typeIds = generatedTypeInfo.map((t) => t.id);
      const title = `Worksheet: ${generatedTypeInfo.map((t) => t.name).join(' + ')}`;
      const saved = await api.saveWorksheet(title, typeIds, generatedPrompts);
      setShowWritingReview(false);
      setGeneratedPrompts([]);
      setGeneratedTypeInfo([]);
      setMessage(
        saved.length === 1
          ? `Writing worksheet "${saved[0].title}" saved successfully!`
          : `${saved.length} writing worksheets saved — one per text type.`
      );
      refreshWriting();
      setWorksheetRefresh(n => n + 1);
      api.getWorksheets().then(setWritingWorksheets).catch(() => {});
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  // Math worksheet generation
  const handleGenerateMath = async () => {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await mathApi.generateWorksheet(selectedTopics, questionCount);
      setGeneratedQuestions(result.questions);
      setShowMathReview(true);
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
      const title = mathWorksheetTitle(selectedTopics, mathTopics);
      await mathApi.saveWorksheet(title, selectedTopics, generatedQuestions);
      setShowMathReview(false);
      setGeneratedQuestions([]);
      setMessage(`Worksheet "${title}" saved successfully!`);
      refreshMath();
      setWorksheetRefresh(n => n + 1);
      mathApi.getWorksheets().then(setMathWorksheets).catch(() => {});
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

  const toggleWritingType = (id: number) => {
    setSelectedWritingTypes(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
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

      {/* Pending worksheets quick view (both subjects) */}
      <PendingWorksheets mode="admin" refreshKey={worksheetRefresh} />

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
              loading={writingHeatmapLoading}
              error={writingHeatmapError}
              onRetry={refreshWriting}
            />
          </div>

          {/* Writing Worksheet Generation */}
          {!showWritingReview ? (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Writing Worksheet</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select one or more text types, or leave empty for auto-selection. Generates one targeted prompt per selected text type — each becomes its own worksheet.
              </p>

              {/* Writing type selector */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={() => setSelectedWritingTypes([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      selectedWritingTypes.length === 0
                        ? 'bg-brand-blue text-white border-brand-blue'
                        : 'border-gray-200 text-gray-600 hover:border-brand-blue'
                    }`}
                  >
                    Auto (weakest first)
                  </button>
                  <span className="text-xs text-gray-400">or select specific types:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                  {writingTypes.map((wt) => {
                    const heatEntry = writingHeatmap.find(h => h.typeSlug === wt.slug);
                    return (
                      <button
                        key={wt.id}
                        onClick={() => toggleWritingType(wt.id)}
                        className={`px-3 py-2 rounded-lg text-xs border text-left transition-colors ${
                          selectedWritingTypes.includes(wt.id)
                            ? 'bg-brand-blue/10 border-brand-blue text-brand-blue'
                            : 'border-gray-200 text-gray-600 hover:border-brand-blue'
                        }`}
                      >
                        <div className="font-medium">{wt.name}</div>
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

              <Button onClick={handleGenerateWriting} disabled={generating}>
                <Plus className="mr-2" size={18} />
                {generating ? 'Generating...' : 'Generate Worksheet'}
              </Button>
            </div>
          ) : (
            /* Review generated writing prompts */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Review Generated Prompts</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowWritingReview(false); setGeneratedPrompts([]); setGeneratedTypeInfo([]); }}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveWritingWorksheet}>
                    Save Worksheet
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-500">
                {generatedPrompts.length} prompt{generatedPrompts.length !== 1 ? 's' : ''} generated — one per text type ({generatedTypeInfo.map(t => t.name).join(', ')}). Saving creates a worksheet for each type.
              </p>
              {generatedPrompts.map((prompt, i) => {
                // prompts are index-aligned with types (one tailored prompt per type)
                const type = generatedTypeInfo[i] || generatedTypeInfo[0];
                return (
                  <div key={i} className="bg-white rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start gap-3">
                      <span className="text-sm font-bold text-gray-400 shrink-0 mt-0.5">Prompt</span>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900 font-medium">{prompt}</p>
                        {type && (
                          <p className="text-xs text-gray-400 mt-2">
                            <span className="font-medium">Text Type:</span> {type.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Saved Writing Worksheets */}
          {writingWorksheets.length > 0 && !showWritingReview && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Saved Writing Worksheets</h2>
              <div className="space-y-2">
                {writingWorksheets.map((ws) => {
                  const prompts = parseJsonArray<string>(ws.prompts);
                  const atts = (ws.attempts || []) as any[];
                  const scored = atts.filter((a: any) => a.analysis?.overallScore != null);
                  return (
                    <div key={ws.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          <FileText size={16} className="text-brand-blue mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{ws.title}</p>
                            <p className="text-xs text-gray-400">
                              {prompts.length} prompt{prompts.length !== 1 ? 's' : ''} · Created {new Date(ws.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                          {atts.length} attempt{atts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {scored.length > 0 && (
                        <div className="mt-2 ml-9 space-y-1">
                          {scored.slice(0, 3).map((a: any) => (
                            <button
                              key={a.id}
                              onClick={() => navigate(`/attempt/${a.id}`)}
                              className="block text-xs text-brand-blue hover:underline"
                            >
                              {new Date(a.finishedAt).toLocaleDateString()} — Score: {a.analysis?.overallScore}/100
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
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
              loading={mathHeatmapLoading}
              error={mathHeatmapError}
              onRetry={refreshMath}
            />
          </div>

          {/* Math Worksheet Generation */}
          {!showMathReview ? (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Generate Mathematics Worksheet</h2>
              <p className="text-sm text-gray-500 mb-4">
                Select one or more topics, or leave empty for all topics. Generates multiple-choice questions at or above the difficulty of the reference test. Students get 1 minute per question.
              </p>

              {/* Question count */}
              <div className="mb-4 flex items-center gap-3">
                <label htmlFor="question-count" className="text-sm font-medium text-gray-700">
                  Number of questions
                </label>
                <input
                  id="question-count"
                  type="number"
                  min={5}
                  max={50}
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Math.max(5, Math.min(50, parseInt(e.target.value) || 35)))}
                  className="w-20 px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
                />
                <span className="text-xs text-gray-400">5–50 · time limit {questionCount} min</span>
              </div>

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
                {generating ? `Generating ${questionCount} Questions...` : `Generate ${questionCount}-Question Worksheet`}
              </Button>
            </div>
          ) : (
            /* Review generated questions */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Review Generated Questions</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setShowMathReview(false); setGeneratedQuestions([]); }}>
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
                        {q.stimulus && validateStimulus(q.stimulus) && (
                          <div className="mb-3 space-y-2">
                            {q.stimulus.text && (
                              <p className="text-sm text-gray-700 whitespace-pre-line">{q.stimulus.text}</p>
                            )}
                            {q.stimulus.figures.map((figure, fi) => (
                              <StimulusFigure key={fi} figure={figure} />
                            ))}
                          </div>
                        )}
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

          {/* Saved Math Worksheets */}
          {mathWorksheets.length > 0 && !showMathReview && (
            <div className="bg-white rounded-xl p-6 border border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Saved Mathematics Worksheets</h2>
              <div className="space-y-2">
                {mathWorksheets.map((ws) => {
                  const questions = parseJsonArray<unknown>(ws.questions);
                  const atts = (ws.attempts || []) as any[];
                  const scored = atts.filter((a: any) => a.score != null);
                  return (
                    <div key={ws.id} className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-start gap-3">
                          <FileText size={16} className="text-brand-blue mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{ws.title}</p>
                            <p className="text-xs text-gray-400">
                              {questions.length} questions · Created {new Date(ws.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-medium text-gray-500 whitespace-nowrap">
                          {atts.length} attempt{atts.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      {scored.length > 0 && (
                        <div className="mt-2 ml-9 space-y-1">
                          {scored.slice(0, 3).map((a: any) => (
                            <button
                              key={a.id}
                              onClick={() => navigate(`/math-attempt/${a.id}`)}
                              className="block text-xs text-brand-blue hover:underline"
                            >
                              {new Date(a.finishedAt).toLocaleDateString()} — Score: {a.score}/{a.totalQuestions}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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