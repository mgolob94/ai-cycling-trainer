import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface WeekAnalysis {
  summary: string;
  form_status: 'fresh' | 'optimal' | 'fatigued' | 'overreaching';
  key_insight: string;
  recommendation: string;
  next_week_tss_target: number | null;
  warning: string | null;
  _cached?: boolean;
  _generated_at?: string;
}

/** AI analysis of the current training week (cached server-side). */
export function useWeekAnalysis() {
  const [analysis, setAnalysis] = useState<WeekAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<WeekAnalysis | null>>(`${apiOrigin}/ai/week-analysis`);
      setAnalysis(data.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load coach analysis.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Invalidate the cached weekly summary, then refetch (forces regeneration).
  const regenerate = useCallback(async () => {
    try {
      await api.delete(`${apiOrigin}/cache/invalidate`, { data: { analysis_type: 'weekly_summary' } });
    } catch {
      // ignore — refetch anyway
    }
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { analysis, loading, error, refresh, regenerate };
}
