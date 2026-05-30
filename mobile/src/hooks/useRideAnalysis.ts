import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface PowerZone {
  zone: string;
  label: string;
  pct: number;
}

export interface RideAnalysis {
  ride: {
    strava_id: string;
    distance_km: number | null;
    duration_sec: number | null;
    avg_power_w: number | null;
    avg_heart_rate: number | null;
    elevation_m: number | null;
    ride_date: string | null;
  };
  normalized_power: number | null;
  xpower: number | null;
  variability_index: number | null;
  efficiency_factor: number | null;
  power_curve: Record<string, number>;
  zones: PowerZone[];
  wprime: {
    min_w_prime_balance: number;
    w_prime_depletion_percent: number;
    match_count: number;
    w_prime_total: number;
    balance_stream: number[];
  };
  ai_analysis: {
    ride_summary: string;
    execution_score: number | null;
    power_zones_feedback: string;
    top_moment: string;
    improvement_tip: string;
    fatigue_impact: 'low' | 'medium' | 'high';
    _cached?: boolean;
    _generated_at?: string;
  };
}

/**
 * Runs the full ride analysis (POST /api/rides/:id/analyze). This is slow
 * (fetches the Strava power stream + calls the AI), so expose loading state.
 */
export function useRideAnalysis(stravaId: string) {
  const [analysis, setAnalysis] = useState<RideAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<RideAnalysis>>(
        `/rides/${stravaId}/analyze`
      );
      setAnalysis(data.data ?? null);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'Failed to analyze ride.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [stravaId]);

  // Invalidate this ride's cached analysis, then re-run (forces regeneration).
  const regenerate = useCallback(async () => {
    try {
      await api.delete(`${apiOrigin}/cache/invalidate`, {
        data: { analysis_type: 'ride_analysis', cache_key: `ride_${stravaId}` },
      });
    } catch {
      // ignore — re-run anyway
    }
    await run();
  }, [run, stravaId]);

  useEffect(() => {
    run();
  }, [run]);

  return { analysis, loading, error, retry: run, regenerate };
}
