import { useState, useEffect } from 'react';
import { improvementsApi, ImprovedTopicDTO } from '@/lib/api';
import { TrendingUp, ChevronRight } from 'lucide-react';

// M3c-1 Task 4: a "Most Improved" panel surfacing recent accuracy/speed gains from the Task 2
// improvements endpoint. Renders nothing when there's nothing to show — this is a celebratory
// panel, not a nag, so an empty state should just disappear rather than show a placeholder.
export default function MostImproved() {
  const [topics, setTopics] = useState<ImprovedTopicDTO[]>([]);
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  useEffect(() => {
    improvementsApi.math()
      .then((res) => setTopics(res.topics))
      // Non-critical widget: on failure show nothing, but surface the error for debugging.
      .catch((e) => console.error('Failed to load improvements:', e));
  }, []);

  if (topics.length === 0) return null;

  return (
    <section data-testid="most-improved" className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center gap-2 mb-1">
        <TrendingUp size={18} className="text-brand-green" />
        <h2 className="text-lg font-semibold text-gray-900">You're getting better at…</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Recent progress based on your last attempts.
      </p>
      <div className="space-y-2">
        {topics.map((t) => {
          const isOpen = openSlug === t.slug;
          const deltaLabel = t.delta.metric === 'accuracy'
            ? `+${t.delta.value}%`
            : `${t.delta.value}% quicker`;
          return (
            <div key={t.slug} className="rounded-lg border border-gray-100">
              <button
                onClick={() => setOpenSlug(isOpen ? null : t.slug)}
                className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-gray-50 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-brand-green shrink-0">▲</span>
                  <span className="text-sm font-medium text-gray-900 truncate">{t.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-brand-green">{deltaLabel}</span>
                  <ChevronRight
                    size={16}
                    className={`text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                  />
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {t.skills.slice(0, 3).map((s) => (
                    <div
                      key={s.slug}
                      className="flex items-center justify-between gap-3 p-2 bg-gray-50 rounded-lg border border-gray-100"
                    >
                      <span className="text-sm text-gray-800 truncate">{s.name}</span>
                      {s.metric === 'accuracy' ? (
                        <span className="text-xs font-semibold text-brand-green whitespace-nowrap">
                          ▲ {Math.round((s.accuracyFrom ?? 0) * 100)}% → {Math.round((s.accuracyTo ?? 0) * 100)}%
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-brand-blue whitespace-nowrap">
                          ⚡ {Math.round(s.quickerPct ?? 0)}% quicker
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
