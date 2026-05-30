import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface RadarPoint {
  duration_sec: number;
  label: string;
  value_pct: number;
  ideal_pct: number;
  power_watts: number | null;
}

export interface RiderProfile {
  rider_type: string;
  label: string;
  icon: string;
  description: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  radar: RadarPoint[];
  goal_alignment: string | null;
}

/** Fetch the user's rider-type profile (classification + radar + recs). */
export function useRiderProfile() {
  const [profile, setProfile] = useState<RiderProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<RiderProfile>>(`${apiOrigin}/profile/rider-type`);
      setProfile(data.data ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rider profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, error, refresh };
}
