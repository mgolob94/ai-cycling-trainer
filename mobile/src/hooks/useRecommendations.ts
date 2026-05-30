import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface Recommendation {
  type: string;
  message: string;
  priority: 'high' | 'medium' | 'low';
  action_cta: string;
}

/** Rule-based training recommendations (top 3). */
export function useRecommendations() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiResponse<Recommendation[]>>(`${apiOrigin}/recommendations`);
      setRecommendations(data.data ?? []);
    } catch {
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { recommendations, loading, refresh };
}
