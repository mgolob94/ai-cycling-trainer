import { useState, useCallback } from 'react';

import { api, ApiResponse } from '../services/api';

export interface Workout {
  day: string;
  type: 'endurance' | 'interval' | 'recovery' | 'rest';
  duration_min: number;
  target: string;
  notes: string;
}

export interface TrainingPlan {
  id: string;
  week_start: string;
  plan_json: { week_start: string; workouts: Workout[] };
}

/** Fetch and generate the current training plan from the backend. */
export function usePlan() {
  const [plan, setPlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCurrent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<TrainingPlan>>('/plans/current');
      setPlan(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<TrainingPlan>>('/plans/generate');
      setPlan(data.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setLoading(false);
    }
  }, []);

  return { plan, loading, error, fetchCurrent, generate };
}
