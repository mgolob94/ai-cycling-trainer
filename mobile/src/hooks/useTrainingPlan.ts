import { useState, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface Workout {
  day: string;
  type: string;
  duration_min: number;
  intensity: string;
  description: string;
}

export interface TrainingPlan {
  id: string;
  week_start: string;
  plan_json: { week_start?: string; summary?: string; workouts: Workout[] };
  generated_at: string;
}

export interface Ride {
  id: string;
  strava_id: string;
  distance_km: number | null;
  duration_sec: number | null;
  avg_power_w: number | null;
  avg_heart_rate: number | null;
  elevation_m: number | null;
  ride_date: string | null;
}

interface UserProfile {
  email: string;
}

interface StravaStatus {
  connected: boolean;
  athlete: { firstname?: string; lastname?: string } | null;
}

function nameFromEmail(email?: string): string {
  if (!email) return 'rider';
  return email.split('@')[0];
}

/**
 * Loads everything the dashboard needs: the user's display name, their most
 * recent ride, and the current week's training plan. Also exposes generatePlan
 * to create a fresh plan on demand.
 */
export function useTrainingPlan() {
  const [name, setName] = useState<string>('');
  const [lastRide, setLastRide] = useState<Ride | null>(null);
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [planRes, rideRes, profileRes, stravaRes] = await Promise.all([
        api.get<ApiResponse<TrainingPlan | null>>('/plans/current'),
        api.get<ApiResponse<Ride | null>>('/rides/latest'),
        api.get<ApiResponse<UserProfile>>('/users/me'),
        api
          .get<ApiResponse<StravaStatus>>(`${apiOrigin}/auth/strava/athlete`)
          .catch(() => null),
      ]);

      setPlan(planRes.data.data ?? null);
      setLastRide(rideRes.data.data ?? null);

      const firstname = stravaRes?.data.data?.athlete?.firstname;
      setName(firstname || nameFromEmail(profileRes.data.data?.email));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  const generatePlan = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<TrainingPlan>>('/plans/generate');
      if (data.data) setPlan(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate a plan.');
    } finally {
      setGenerating(false);
    }
  }, []);

  return { name, lastRide, plan, loading, generating, error, refresh, generatePlan };
}
