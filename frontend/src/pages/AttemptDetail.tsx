import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, Attempt } from '@/lib/api';
import { ArrowLeft, Clock, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AnalysisDisplay from '@/components/AnalysisDisplay';

export default function AttemptDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const fetchAttempt = async () => {
      try {
        const a = await api.getAttempt(parseInt(id));
        if (cancelled) return;
        setAttempt(a);
        setLoading(false);
        // The analysis endpoint runs synchronously — one awaited trigger, then refetch.
        if (!a.analysis) {
          setAnalysisError(null);
          try {
            await api.triggerAnalysis(parseInt(id));
            const refreshed = await api.getAttempt(parseInt(id));
            if (!cancelled) setAttempt(refreshed);
          } catch (e: any) {
            if (!cancelled) setAnalysisError(e.message);
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    fetchAttempt();
    return () => { cancelled = true; };
  }, [id, retryToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 size={32} className="animate-spin text-brand-blue mx-auto" />
          <p className="text-gray-500 mt-4">Analysing your writing...</p>
          <p className="text-xs text-gray-400 mt-2">This usually takes a few seconds</p>
        </div>
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="text-center py-20">
        <p className="text-red-500">{error || 'Attempt not found'}</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const timeMinutes = Math.floor(attempt.timeTaken / 60);
  const timeSeconds = attempt.timeTaken % 60;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attempt Detail</h1>
          <p className="text-sm text-gray-500">
            {new Date(attempt.finishedAt).toLocaleDateString('en-AU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Meta info */}
      <div className="flex gap-6 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <Clock size={14} />
          <span>{timeMinutes}m {timeSeconds}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText size={14} />
          <span>{attempt.text.trim().split(/\s+/).filter(w => w.length > 0).length} words</span>
        </div>
        <span className="capitalize">{attempt.source}</span>
      </div>

      {/* Student's writing */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Your Writing</h2>
        <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">{attempt.text}</div>
      </div>

      {/* Analysis (if available) */}
      {attempt.analysis ? (
        <AnalysisDisplay analysis={attempt.analysis} />
      ) : analysisError ? (
        <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
          <p className="text-gray-700 font-medium">Analysis is unavailable right now</p>
          <p className="text-sm text-gray-500 mt-1">{analysisError}</p>
          <Button variant="outline" className="mt-4" onClick={() => setRetryToken(t => t + 1)}>
            Retry Analysis
          </Button>
        </div>
      ) : (
        <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
          <Loader2 size={24} className="animate-spin text-brand-blue mx-auto" />
          <p className="text-gray-500 mt-2">Analysing your writing...</p>
        </div>
      )}
    </div>
  );
}