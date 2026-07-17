import { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Timer from '@/components/Timer';

const TOTAL_TIME = 1800; // 30 minutes in seconds

export default function TimedPractice() {
  const location = useLocation();
  const navigate = useNavigate();
  const { typeSlug } = useParams<{ typeSlug: string }>();
  const { prompt, type, worksheetId, worksheetPromptText } = location.state || {};

  const [text, setText] = useState('');
  const [timeLeft, setTimeLeft] = useState(TOTAL_TIME);
  const [running, setRunning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setRunning(false);
    setSubmitting(true);
    setSaveError(false);

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const attempt = await api.createAttempt({
        text,
        promptId: prompt?.id || 0,
        typeId: type?.id || 0,
        startedAt: new Date(startTimeRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: Math.min(elapsed, TOTAL_TIME - timeLeft),
        source: worksheetId ? 'worksheet' : 'practice',
        worksheetId: worksheetId || undefined,
      });
      // The attempt detail page triggers and awaits the AI analysis.
      navigate(`/attempt/${attempt.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save attempt:', err);
      setSubmitting(false);
      submittedRef.current = false;
      setSaveError(true);
    }
  }, [text, prompt, type, worksheetId, timeLeft, navigate]);

  // Handle time up
  const handleTimeUp = useCallback(() => {
    submitAttempt();
  }, [submitAttempt]);

  // Handle tick
  const handleTick = useCallback(() => {
    setTimeLeft((t) => Math.max(0, t - 1));
  }, []);

  // Warn before unload if text entered
  useEffect(() => {
    if (text.length === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [text]);

  // Redirect if no prompt
  if (!prompt || !type) {
    navigate(`/practice/${typeSlug}`, { replace: true });
    return null;
  }

  if (saveError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold text-gray-900">We couldn't save your writing</p>
          <p className="text-gray-600">
            Something went wrong while saving. Your writing is still here — nothing is lost.
          </p>
          <Button onClick={submitAttempt}>Try Again</Button>
        </div>
      </div>
    );
  }

  if (submitting) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue mx-auto" />
          <p className="text-gray-500 mt-4">Saving your writing...</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <p className="text-lg text-gray-700">Are you sure you want to submit?</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setConfirmed(false)}>Keep Writing</Button>
            <Button onClick={submitAttempt}>Submit Now</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Timer row */}
      <div className="flex items-center gap-6">
        <Timer
          timeLeft={timeLeft}
          total={TOTAL_TIME}
          onTick={handleTick}
          onTimeUp={handleTimeUp}
          running={running}
        />
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
            {worksheetId ? 'Worksheet Prompt' : 'Prompt'}
          </p>
          <p className="text-gray-800 mt-1">{worksheetPromptText || prompt.text}</p>
          <p className="text-xs text-gray-400 mt-1">
            Type: {type.name} — Word count: {wordCount}
            {worksheetId && <span className="ml-2 text-brand-amber">· Worksheet</span>}
          </p>
        </div>
      </div>

      {/* Text area */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Start writing here..."
        className="w-full h-96 p-4 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-brand-blue/50 text-gray-800 leading-relaxed"
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />

      {/* Bottom bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {wordCount} word{wordCount !== 1 ? 's' : ''}
        </p>
        <Button
          variant="outline"
          onClick={() => {
            if (text.trim().length > 0) {
              setConfirmed(true);
            } else {
              submitAttempt();
            }
          }}
          disabled={submitting}
        >
          Submit Early
        </Button>
      </div>
    </div>
  );
}