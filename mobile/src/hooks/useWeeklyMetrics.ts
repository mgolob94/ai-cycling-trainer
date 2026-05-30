import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface WeeklyMetric {
  week_start: string;
  tss: number;
  atl: number;
  ctl: number;
  tsb: number;
  total_distance_km: number;
  total_duration_sec: number;
  total_elevation_m: number;
  avg_power_w: number | null;
  ride_count: number;
}

/** Last 12 weeks of training-load metrics. */
export function useWeeklyMetrics() {
  const [weeks, setWeeks] = useState<WeeklyMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<WeeklyMetric[]>>(`${apiOrigin}/metrics/weekly`);
      setWeeks(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { weeks, loading, error, refresh };
}
