import { useState, useEffect } from 'react';
import { mathApi, MathTopic, GeneratedMathQuestion } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Brain, CheckCircle } from 'lucide-react';
import MathStimulusDisplay from './MathStimulusDisplay';

// W-95: admin Thinking Skills worksheet generation — mirrors the Mathematics generate flow but
// self-contained so it can't affect the Mathematics UX. Select sections + a question count →
// generate (the same subject-aware engine, 4-option) → review → save UNASSIGNED. The saved
// worksheet then appears in the Saved Worksheets list, where it can be assigned (W-85).
export default function ThinkingSkillsGenerate({ onSaved }: { onSaved: () => void }) {
  const [sections, setSections] = useState<MathTopic[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState('10');
  const [jobId, setJobId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GeneratedMathQuestion[]>([]);
  const [review, setReview] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    mathApi.getTopics('thinking-skills').then(setSections).catch(() => {});
  }, []);

  const questionCount = Math.max(5, Math.min(50, parseInt(count) || 10));
  const toggle = (slug: string) =>
    setSelected((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]));

  const generate = async () => {
    setMsg(null);
    try {
      const { jobId } = await mathApi.startGeneration(selected, questionCount);
      setJobId(jobId);
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const job = await mathApi.getGenerationJob(jobId);
        if (cancelled) return;
        if (job.status === 'done' && job.result) {
          setQuestions(job.result.questions);
          setReview(true);
          setMsg(`Generated ${job.result.questions.length} questions.`);
          setJobId(null);
        } else if (job.status === 'error') {
          setMsg(`Error: ${job.error || 'Generation failed'}`);
          setJobId(null);
        } else {
          timer = setTimeout(tick, 2000);
        }
      } catch {
        if (!cancelled) { setMsg('That generation is no longer available.'); setJobId(null); }
      }
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [jobId]);

  const save = async () => {
    setMsg(null);
    try {
      const names = sections.filter((s) => selected.includes(s.slug)).map((s) => s.name);
      const title = `Thinking Skills: ${names.join(', ')}`;
      await mathApi.saveWorksheet(title, selected, questions, []); // [] = save UNASSIGNED (undefined would assign to all)
      setReview(false);
      setQuestions([]);
      setSelected([]);
      setMsg(`Saved "${title}". Assign it from Saved Worksheets below.`);
      onSaved();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    }
  };

  const labels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div data-testid="ts-generate" className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={18} className="text-brand-blue" />
        <h2 className="text-lg font-semibold text-gray-900">Generate Thinking Skills Worksheet</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Pick one or more sections; questions are 4-option, at exam difficulty.</p>

      {!review ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            {sections.map((s) => (
              <button
                key={s.id}
                onClick={() => toggle(s.slug)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${selected.includes(s.slug) ? 'border-brand-blue bg-brand-blue/10 text-brand-blue font-medium' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-600">Number of questions</label>
            <input
              aria-label="Number of questions"
              className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-sm"
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
            <Button onClick={generate} disabled={selected.length === 0 || jobId !== null}>
              {jobId ? 'Generating…' : `Generate ${questionCount}-Question Worksheet`}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Review Generated Questions ({questions.length})</h3>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-gray-100 p-4">
                <p className="text-sm font-medium text-gray-900 mb-2">{i + 1}. {q.questionText}</p>
                {q.stimulus && <div className="mb-2"><MathStimulusDisplay stimulus={JSON.stringify(q.stimulus)} /></div>}
                <ul className="space-y-1 mb-2">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className={`text-sm flex items-center gap-2 ${oi === q.correctIndex ? 'text-green-700 font-medium' : 'text-gray-700'}`}>
                      {oi === q.correctIndex && <CheckCircle size={14} className="text-green-600" />}
                      <span className="text-gray-400">{labels[oi]}.</span> {opt}
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500"><span className="font-semibold">Explanation:</span> {q.explanation}</p>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <Button onClick={save}>Save Worksheet</Button>
            <Button variant="ghost" onClick={() => { setReview(false); setQuestions([]); }}>Discard</Button>
          </div>
        </>
      )}

      {msg && <p className="mt-3 text-sm text-gray-600">{msg}</p>}
    </div>
  );
}
