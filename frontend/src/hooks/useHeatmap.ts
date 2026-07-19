import { useState, useEffect } from 'react';
import { api, HeatmapEntry } from '@/lib/api';

// studentId (admin only, C1) scopes the heatmap to one workspace student; undefined =
// the caller's own data, or the whole workspace for an admin.
export function useHeatmap(studentId?: number) {
  const [data, setData] = useState<HeatmapEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.getHeatmap(studentId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId]);

  const refresh = () => load();

  return { data, loading, error, refresh };
}
