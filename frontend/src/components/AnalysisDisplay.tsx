import { Analysis } from '@/lib/api';

interface AnalysisDisplayProps {
  analysis: Analysis;
}

function ScoreBar({ label, score, comments }: { label: string; score: number; comments: string }) {
  const color =
    score >= 80 ? 'bg-green-500' :
    score >= 60 ? 'bg-brand-green' :
    score >= 40 ? 'bg-brand-amber' :
    'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-lg font-bold" style={{ color: score >= 40 ? undefined : '#ef4444' }}>
          {score}/100
        </span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <p className="text-sm text-gray-600 leading-relaxed">{comments}</p>
    </div>
  );
}

export default function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Overall Score</h2>
        <div className="flex items-center gap-4">
          <span className="text-5xl font-bold text-brand-blue">{analysis.overallScore}</span>
          <span className="text-gray-500">/ 100</span>
        </div>
        <p className="text-gray-600 mt-4 leading-relaxed">{analysis.summary}</p>
      </div>

      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-6">
        <h2 className="text-lg font-semibold text-gray-900">Detailed Breakdown</h2>
        <ScoreBar label="Vocabulary" score={analysis.vocabScore} comments={analysis.vocabComments} />
        <hr className="border-gray-100" />
        <ScoreBar label="Sentence Structure & Flow" score={analysis.structureScore} comments={analysis.structureComments} />
        <hr className="border-gray-100" />
        <ScoreBar label="Content & Structure" score={analysis.contentScore} comments={analysis.contentComments} />
      </div>
    </div>
  );
}