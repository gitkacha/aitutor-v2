import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { mathApi, MathQuestionFull } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Timer from '@/components/Timer';
import MathQuestionCard from '@/components/MathQuestionCard';
import MathStimulusDisplay from '@/components/MathStimulusDisplay';
import { Flag } from 'lucide-react';

export default function MathTimedPractice() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { worksheetId } = location.state || {};

  const [questions, setQuestions] = useState<MathQuestionFull[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  // Questions the student flagged to revisit (W-17), by question id.
  const [flagged, setFlagged] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const hasStarted = useRef(false);
  // Per-question dwell time, flags and answer-change counts (Milestone 3a capture) — invisible
  // to the student, read back by the coaching/analysis layer later.
  const dwellRef = useRef<Record<number, number>>({});
  const lastSwitchRef = useRef<number>(Date.now());
  const changesRef = useRef<Record<number, number>>({});
  const recordDwell = (qid: number) => {
    const now = Date.now();
    dwellRef.current[qid] = (dwellRef.current[qid] ?? 0) + (now - lastSwitchRef.current);
    lastSwitchRef.current = now;
  };

  const isWorksheet = !!worksheetId;

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const slug = topicSlug === 'all-topics' ? undefined : topicSlug;
    const fetchQuestions = isWorksheet
      ? mathApi.getQuestions({ worksheetId })
      : mathApi.getQuestions({ topicSlug: slug });

    fetchQuestions
      .then(setQuestions)
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [topicSlug, navigate, isWorksheet, worksheetId]);

  // Worksheets allot 1 minute per question; regular practice keeps the exam
  // formula of ~69s per question capped at 40 minutes.
  const totalTime = isWorksheet
    ? questions.length * 60
    : Math.min(questions.length * 69, 2400);
  // Fixed end timestamp (L2), anchored to the moment the student presses Start test
  // (W-16) — the countdown derives from Date.now() so it never drifts and survives Timer
  // unmounts.
  const [started, setStarted] = useState(false);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const handleStart = () => {
    setEndTime(Date.now() + totalTime * 1000);
    setTimeLeft(totalTime);
    setStarted(true);
    // Dwell clock starts with the test itself, not at mount — the start-confirmation
    // screen (W-16) must never inflate Q1's dwell time.
    lastSwitchRef.current = Date.now();
  };

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const activeQ = questions[currentIndex];
    if (activeQ) recordDwell(activeQ.id);
    setRunning(false);
    setSubmitting(true);
    setSaveError(false);

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const qIds = questions.map(q => q.id);
      const answerArray = questions.map(q => answers[q.id] ?? -1);
      const topicId = questions[0]?.topicId ?? null;

      const attempt = await mathApi.createAttempt({
        topicId: isWorksheet || topicSlug === 'all-topics' ? null : topicId,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(answerArray),
        startedAt: new Date(startTimeRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: Math.min(elapsed, totalTime - timeLeft),
        source: isWorksheet ? 'worksheet' : 'practice',
        worksheetId: isWorksheet ? worksheetId : undefined,
        questionTimings: JSON.stringify(dwellRef.current),
        questionFlags: JSON.stringify([...flagged]),
        answerChanges: JSON.stringify(changesRef.current),
      });

      navigate(`/math-attempt/${attempt.id}`, { replace: true });
    } catch (err) {
      // A failed save must be visible, never a silent return to a frozen test (M6).
      console.error('Failed to save attempt:', err);
      setSubmitting(false);
      submittedRef.current = false;
      setSaveError(true);
    }
  }, [questions, answers, topicSlug, totalTime, timeLeft, navigate, isWorksheet, worksheetId, currentIndex, flagged]);

  const handleTimeUp = useCallback(() => submitAttempt(), [submitAttempt]);

  const handleTick = useCallback((remainingSeconds: number) => {
    setTimeLeft(remainingSeconds);
  }, []);

  // Warn before unload
  useEffect(() => {
    if (Object.keys(answers).length === 0) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [answers]);

  const currentQ = questions[currentIndex];
  const isLast = currentIndex >= questions.length - 1;
  const answeredCount = Object.keys(answers).length;

  // Flag / revisit (W-17).
  const toggleFlag = (id: number) =>
    setFlagged((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const jumpTo = (index: number) => {
    if (currentQ) recordDwell(currentQ.id);
    setCurrentIndex(index);
    setConfirmed(false);
  };
  const flaggedIdx = questions.map((q, i) => ({ q, i })).filter(({ q }) => flagged.has(q.id)).map(({ i }) => i);
  const unansweredIdx = questions.map((q, i) => ({ q, i })).filter(({ q }) => answers[q.id] == null).map(({ i }) => i);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-blue" />
      </div>
    );
  }

  if (questions.length === 0) {
    return <div className="text-center py-20 text-gray-500">No questions available for this topic.</div>;
  }

  // Start-test confirmation (W-16): the clock only begins on Start test.
  if (!started) {
    const minutes = Math.max(1, Math.round(totalTime / 60));
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-5">
          <h1 className="text-2xl font-bold text-gray-900">Ready to start?</h1>
          <div className="bg-gray-50 rounded-xl p-4 inline-flex flex-col gap-1 text-gray-700">
            <span><span className="font-semibold">{questions.length}</span> question{questions.length !== 1 ? 's' : ''}</span>
            <span><span className="font-semibold">{minutes}</span> minute limit · 5 options each</span>
          </div>
          <p className="text-gray-600">
            The countdown starts when you press the button. You can flag questions and come back
            to them; the test auto-submits when time runs out.
          </p>
          <Button size="lg" onClick={handleStart}>Start test</Button>
        </div>
      </div>
    );
  }

  if (saveError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4 max-w-md">
          <p className="text-lg font-semibold text-gray-900">We couldn't save your answers</p>
          <p className="text-gray-600">
            Something went wrong while saving. Your answers are still here — nothing is lost.
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
          <p className="text-gray-500 mt-4">Saving your answers...</p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    // Chips let the student jump back to flagged or unanswered questions while time
    // remains (W-17).
    const chips = (label: string, indices: number[], amber?: boolean) =>
      indices.length > 0 && (
        <div className="text-sm" data-testid={`jump-${label.toLowerCase()}`}>
          <span className="text-gray-500">{label} ({indices.length}):</span>
          <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
            {indices.map((i) => (
              <button
                key={i}
                onClick={() => jumpTo(i)}
                className={`px-2 py-0.5 rounded-md border text-xs font-medium ${amber ? 'border-brand-amber text-brand-amber' : 'border-gray-300 text-gray-600'} hover:bg-gray-50`}
              >
                Q{i + 1}
              </button>
            ))}
          </span>
        </div>
      );
    return (
      <div className="max-w-lg mx-auto py-16 text-center space-y-5">
        <p className="text-lg text-gray-700">
          {answeredCount < questions.length
            ? `You've answered ${answeredCount} of ${questions.length} questions. ${questions.length - answeredCount} will be marked as unanswered.`
            : 'Are you sure you want to submit?'}
        </p>
        {(flaggedIdx.length > 0 || unansweredIdx.length > 0) && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-left inline-block">
            <p className="text-xs text-gray-500">Time left? Jump back to review:</p>
            {chips('Flagged', flaggedIdx, true)}
            {chips('Unanswered', unansweredIdx)}
          </div>
        )}
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={() => setConfirmed(false)}>Keep Going</Button>
          <Button onClick={submitAttempt}>Submit Now</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar: progress + timer */}
      <div className="flex items-center gap-4">
        {endTime !== null && (
          <Timer
            endTime={endTime}
            total={totalTime}
            onTick={handleTick}
            onTimeUp={handleTimeUp}
            running={running}
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className="bg-brand-blue h-2 rounded-full transition-all"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-500 whitespace-nowrap">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {answeredCount} answered · {questions.length - answeredCount} remaining
            {isWorksheet && <span className="ml-2 text-brand-amber">· Worksheet</span>}
          </p>
        </div>
      </div>

      {/* Question */}
      {currentQ && (
        <div className="space-y-4">
          {currentQ.stimulusGroup && (
            <MathStimulusDisplay stimulus={currentQ.stimulusGroup.stimulus} />
          )}
          <MathQuestionCard
            question={currentQ}
            selectedIndex={answers[currentQ.id] ?? -1}
            onSelect={(index) => {
              if (answers[currentQ.id] != null && answers[currentQ.id] !== index) {
                changesRef.current[currentQ.id] = (changesRef.current[currentQ.id] ?? 0) + 1;
              }
              setAnswers(prev => ({ ...prev, [currentQ.id]: index }));
            }}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <Button variant="outline" onClick={() => { if (currentQ) recordDwell(currentQ.id); setCurrentIndex(i => i - 1); }}>
              Previous
            </Button>
          )}
          {currentQ && (
            <Button
              variant="outline"
              onClick={() => toggleFlag(currentQ.id)}
              className={flagged.has(currentQ.id) ? 'border-brand-amber text-brand-amber' : ''}
            >
              <Flag size={15} className="mr-1" fill={flagged.has(currentQ.id) ? 'currentColor' : 'none'} />
              {flagged.has(currentQ.id) ? 'Flagged' : 'Flag'}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setConfirmed(true)}
          >
            Submit All
          </Button>
          {!isLast ? (
            <Button onClick={() => { if (currentQ) recordDwell(currentQ.id); setCurrentIndex(i => i + 1); }}>
              Next
            </Button>
          ) : (
            <Button onClick={() => setConfirmed(true)}>
              Finish Test
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
