import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { mathApi, MathQuestionFull } from '@/lib/api';
import { Button } from '@/components/ui/button';
import Timer from '@/components/Timer';
import MathQuestionCard from '@/components/MathQuestionCard';
import MathStimulusDisplay from '@/components/MathStimulusDisplay';

export default function MathTimedPractice() {
  const { topicSlug } = useParams<{ topicSlug: string }>();
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<MathQuestionFull[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const startTimeRef = useRef(Date.now());
  const submittedRef = useRef(false);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    const slug = topicSlug === 'all-topics' ? undefined : topicSlug;
    mathApi.getQuestions(slug)
      .then(setQuestions)
      .catch(() => navigate('/dashboard'))
      .finally(() => setLoading(false));
  }, [topicSlug, navigate]);

  const totalTime = Math.min(questions.length * 69, 2400); // 69s per Q, max 40 min
  const [timeLeft, setTimeLeft] = useState(totalTime);

  const submitAttempt = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setRunning(false);
    setSubmitting(true);

    try {
      const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
      const qIds = questions.map(q => q.id);
      const answerArray = questions.map(q => answers[q.id] ?? -1);
      const topicId = questions[0]?.topicId ?? null;

      const attempt = await mathApi.createAttempt({
        topicId: topicSlug === 'all-topics' ? null : topicId,
        questions: JSON.stringify(qIds),
        answers: JSON.stringify(answerArray),
        startedAt: new Date(startTimeRef.current).toISOString(),
        finishedAt: new Date().toISOString(),
        timeTaken: Math.min(elapsed, totalTime - timeLeft),
        source: 'practice',
      });

      navigate(`/math-attempt/${attempt.id}`, { replace: true });
    } catch (err) {
      console.error('Failed to save attempt:', err);
      setSubmitting(false);
      submittedRef.current = false;
    }
  }, [questions, answers, topicSlug, totalTime, timeLeft, navigate]);

  const handleTimeUp = useCallback(() => submitAttempt(), [submitAttempt]);

  const handleTick = useCallback(() => {
    setTimeLeft(t => Math.max(0, t - 1));
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
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-4">
          <p className="text-lg text-gray-700">
            {answeredCount < questions.length
              ? `You've answered ${answeredCount} of ${questions.length} questions. ${questions.length - answeredCount} will be marked as unanswered.`
              : 'Are you sure you want to submit?'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => setConfirmed(false)}>Keep Going</Button>
            <Button onClick={submitAttempt}>Submit Now</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar: progress + timer */}
      <div className="flex items-center gap-4">
        <Timer
          timeLeft={timeLeft}
          total={totalTime}
          onTick={handleTick}
          onTimeUp={handleTimeUp}
          running={running}
        />
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
            onSelect={(index) => setAnswers(prev => ({ ...prev, [currentQ.id]: index }))}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {currentIndex > 0 && (
            <Button variant="outline" onClick={() => setCurrentIndex(i => i - 1)}>
              Previous
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
            <Button onClick={() => setCurrentIndex(i => i + 1)}>
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