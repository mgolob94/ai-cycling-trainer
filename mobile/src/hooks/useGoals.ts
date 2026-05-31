import { useCallback, useEffect, useState } from 'react';
import { api, apiOrigin, ApiResponse } from '../services/api';

export type GoalType = 'ftp_target' | 'event' | 'consistency' | 'distance' | 'fitness';

export interface Goal {
  id: string;
  goal_type: GoalType;
  title: string | null;
  target_date: string | null;
  target_ftp: number | null;
  target_distance_km: number | null;
  target_event_name: string | null;
  current_progress: number;
  status: 'active' | 'completed' | 'abandoned';
  created_at: string;
}

export interface GoalInsight {
  on_track: boolean;
  message: string;
  critical_action: string | null;
  estimated_achievement_date: string | null;
  progress: number;
}

export interface NewGoal {
  goal_type: GoalType;
  title?: string;
  target_date?: string | null;
  target_ftp?: number | null;
  target_distance_km?: number | null;
  target_event_name?: string | null;
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<Goal[]>>(`${apiOrigin}/goals`);
      setGoals(data.data ?? []);
    } catch {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createGoal = useCallback(
    async (goal: NewGoal) => {
      await api.post<ApiResponse<Goal>>(`${apiOrigin}/goals`, goal);
      await load();
    },
    [load]
  );

  const updateStatus = useCallback(
    async (id: string, status: Goal['status']) => {
      await api.patch<ApiResponse<Goal>>(`${apiOrigin}/goals/${id}`, { status });
      await load();
    },
    [load]
  );

  const fetchInsight = useCallback(async (id: string): Promise<GoalInsight | null> => {
    try {
      const { data } = await api.post<ApiResponse<GoalInsight>>(`${apiOrigin}/goals/${id}/insight`);
      return data.data;
    } catch {
      return null;
    }
  }, []);

  return { goals, loading, reload: load, createGoal, updateStatus, fetchInsight };
}
