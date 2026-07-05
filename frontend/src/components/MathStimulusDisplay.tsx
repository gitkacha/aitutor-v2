interface MathStimulusDisplayProps {
  stimulus: string;
}

export default function MathStimulusDisplay({ stimulus }: MathStimulusDisplayProps) {
  return (
    <div className="bg-brand-blue/5 border border-brand-blue/20 rounded-xl p-5">
      <p className="text-xs font-semibold text-brand-blue uppercase tracking-wider mb-2">Shared Information</p>
      <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">{stimulus}</p>
    </div>
  );
}