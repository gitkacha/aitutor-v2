import { parseStimulus } from '@/lib/stimulus';
import StimulusFigure from './StimulusFigure';

interface MathStimulusDisplayProps {
  stimulus: string;
}

// Shared question context. Structured JSON stimuli (W-8) render their text plus real
// figures; legacy prose strings render as text, unchanged.
export default function MathStimulusDisplay({ stimulus }: MathStimulusDisplayProps) {
  const spec = parseStimulus(stimulus);
  return (
    <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-5">
      <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider mb-2">Shared Information</p>
      {spec ? (
        <div className="space-y-2">
          {spec.text && <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{spec.text}</p>}
          {spec.figures.map((figure, i) => (
            <StimulusFigure key={i} figure={figure} />
          ))}
        </div>
      ) : (
        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{stimulus}</p>
      )}
    </div>
  );
}
