import { MathQuestionFull } from '@/lib/api';
import { cn } from '@/lib/utils';

interface MathQuestionCardProps {
  question: MathQuestionFull;
  selectedIndex: number;
  onSelect: (index: number) => void;
  showResult?: boolean;
  correctIndex?: number;
}

export default function MathQuestionCard({ question, selectedIndex, onSelect, showResult, correctIndex }: MathQuestionCardProps) {
  let options: string[];
  try {
    options = JSON.parse(question.options);
  } catch {
    options = ['A', 'B', 'C', 'D', 'E'];
  }

  const labels = ['A', 'B', 'C', 'D', 'E'];

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <p className="text-gray-900 font-medium leading-relaxed whitespace-pre-line">{question.questionText}</p>
      <div className="mt-4 space-y-2">
        {options.map((option, i) => {
          let optionClass = 'border-gray-200 hover:border-brand-blue hover:bg-brand-blue/5 cursor-pointer';
          if (selectedIndex === i) {
            optionClass = 'border-brand-blue bg-brand-blue/10';
          }
          if (showResult && correctIndex !== undefined) {
            if (i === correctIndex) {
              optionClass = 'border-green-500 bg-green-50';
            } else if (i === selectedIndex && selectedIndex !== correctIndex) {
              optionClass = 'border-red-500 bg-red-50';
            }
          }

          return (
            <button
              key={i}
              onClick={() => !showResult && onSelect(i)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all',
                optionClass,
                showResult && 'cursor-default'
              )}
            >
              <span className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium shrink-0',
                selectedIndex === i ? 'bg-brand-blue text-white' : 'bg-gray-100 text-gray-600',
                showResult && i === correctIndex && 'bg-green-500 text-white',
                showResult && i === selectedIndex && i !== correctIndex && 'bg-red-500 text-white'
              )}>
                {labels[i]}
              </span>
              <span className="text-gray-800">{option}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}