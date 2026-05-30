import { useCallback, useEffect, useState } from 'react';

import { api, type ApiResponse } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';

export interface RecoveryScore {
  date: string;
  recovery_score: number;
  hrv_score: number;
  sleep_score: number;
  training_load_score: number;
  readiness_label: string;
  recommendation: string;
}

export interface HrvPoint {
  recorded_at: string;
  hrv_ms: number;
}

export interface SleepSession {
  date: string;
  duration_min: number | null;
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  awake_min: number | null;
  sleep_score: number | null;
}

export interface SourceConnection {
  source: string;
  is_connected: boolean;
  last_sync_at: string | null;
}

interface Workout {
  type?: string;
  intensity?: string;
  duration_min?: number;
  name?: string;
  adaptation?: { adapted?: boolean; note?: string };
}
export interface Adaptation {
  original: Workout;
  adapted: Workout;
  warning: { level: string; message: string } | null;
}

export interface RecoveryData {
  score: RecoveryScore | null;
  adaptation: Adaptation | null;
  hrv: HrvPoint[];
  hrvBaseline: number | null;
  lastSleep: SleepSession | null;
  sources: SourceConnection[];
}

const empty: RecoveryData = {
  score: null,
  adaptation: null,
  hrv: [],
  hrvBaseline: null,
  lastSleep: null,
  sources: [],
};

/** Loads today's recovery score (computing it), adaptation, and the inputs. */
export function useRecovery() {
  const userId = useAuthStore((s) => s.userId);
  const [data, setData] = useState<RecoveryData>(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Ensure today's score + adaptation exist, then read the inputs.
      const [scoreRes, adaptRes] = await Promise.all([
        api.post<ApiResponse<RecoveryScore>>('/recovery/calculate').catch(() => null),
        api.post<ApiResponse<Adaptation & { adapted?: Workout }>>('/training/adapt-for-recovery').catch(() => null),
      ]);
      const score = scoreRes?.data.data ?? null;

      const adaptPayload = adaptRes?.data.data as
        | { original: Workout; adapted: Workout; warning: Adaptation['warning'] }
        | undefined;
      const adaptation =
        adaptPayload?.adapted?.adaptation?.adapted
          ? { original: adaptPayload.original, adapted: adaptPayload.adapted, warning: adaptPayload.warning }
          : null;

      let hrv: HrvPoint[] = [];
      let hrvBaseline: number | null = null;
      let lastSleep: SleepSession | null = null;
      let sources: SourceConnection[] = [];

      if (userId) {
        const since = new Date();
        since.setDate(since.getDate() - 30);
        const sinceIso = since.toISOString();

        const [hrvQ, sleepQ, srcQ] = await Promise.all([
          supabase
            .from('hrv_readings')
            .select('recorded_at, hrv_ms')
            .eq('user_id', userId)
            .gte('recorded_at', sinceIso)
            .not('hrv_ms', 'is', null)
            .order('recorded_at', { ascending: true }),
          supabase
            .from('sleep_sessions')
            .select('date, duration_min, deep_min, rem_min, light_min, awake_min, sleep_score')
            .eq('user_id', userId)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('source_connections')
            .select('source, is_connected, last_sync_at')
            .eq('user_id', userId),
        ]);

        const allHrv = (hrvQ.data ?? []) as HrvPoint[];
        if (allHrv.length) {
          hrvBaseline = Math.round(allHrv.reduce((s, p) => s + p.hrv_ms, 0) / allHrv.length);
          hrv = allHrv.slice(-14); // last 14 days for the sparkline
        }
        lastSleep = (sleepQ.data as SleepSession | null) ?? null;
        sources = (srcQ.data ?? []) as SourceConnection[];
      }

      setData({ score, adaptation, hrv, hrvBaseline, lastSleep, sources });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load recovery.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...data, loading, error, refresh: load };
}
