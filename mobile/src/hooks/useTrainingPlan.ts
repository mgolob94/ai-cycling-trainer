import { useState, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface Workout {
  day: string;
  type: string;
  duration_min: number;
  intensity: string;
  description: string;
  zone?: number;
  is_key_workout?: boolean;
}

export interface StrengthSession {
  day: string;
  focus: string;
  duration_min: number;
  exercises: string[];
  reason?: string;
}

export interface NutritionDay {
  day: string;
  pre_ride?: string | null;
  during_ride?: string | null;
  post_ride?: string | null;
  note?: string | null;
}

export interface NutritionGuide {
  week_focus?: string;
  daily: NutritionDay[];
}

export interface PlanReasoning {
  headline?: string;
  bullets?: string[];
  key_workout?: { day?: string; why?: string };
  what_to_expect?: string;
}

export interface TrainingPlan {
  id: string;
  week_start: string;
  phase?: string;
  phase_week?: number;
  phase_total_weeks?: number;
  tss_target?: number;
  week_theme?: string;
  coach_intro?: string;
  reasoning?: PlanReasoning;
  completion_pct?: number;
  tss_achieved?: number;
  plan_json: {
    week_start?: string;
    summary?: string;
    week_theme?: string;
    coach_intro?: string;
    reasoning?: PlanReasoning;
    phase?: string;
    phase_week?: number;
    phase_total_weeks?: number;
    workouts: Workout[];
    strength_sessions?: StrengthSession[];
    nutrition?: NutritionGuide;
  };
  generated_at: string;
}

export interface PhaseResult {
  phase: string;
  phase_week: number;
  phase_total_weeks: number;
  weeks_to_event: number | null;
  event_name?: string | null;
  tss_target: number;
  rationale: string;
  next_phase: string;
  weeks_until_next_phase: number;
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
