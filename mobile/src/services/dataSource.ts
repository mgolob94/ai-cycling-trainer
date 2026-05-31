import { isDevice } from 'expo-device';

import { MockData } from './mockData';
import * as appleHealth from './appleHealth';
import { supabase } from './supabase';
import { api, type ApiResponse } from './api';
import { useAuthStore } from '../store/useAuthStore';
import { useDemoStore } from '../store/useDemoStore';

// Universal data-source wrapper. This is the ONLY data module screens/hooks
// should import — never appleHealth/garmin/whoop directly. It returns mock data
// on the dev simulator OR in demo mode, and real data otherwise.

const DEV_SIMULATOR = __DEV__ && !isDevice;
function mockActive(): boolean {
  return DEV_SIMULATOR || useDemoStore.getState().demo;
}

type Source = 'apple_health' | 'garmin' | 'whoop' | null;

interface HRVReading {
  recorded_at: string;
  hrv_ms: number | null;
  resting_hr?: number | null;
  source: string;
}
interface SleepSession {
  date: string;
  duration_min: number | null;
  deep_min: number | null;
  rem_min: number | null;
  light_min: number | null;
  awake_min: number | null;
  sleep_score: number | null;
  source: string;
}
interface RecoveryScore {
  date: string;
  recovery_score: number;
  hrv_score: number;
  sleep_score: number;
  training_load_score: number;
  readiness_label: string;
  recommendation: string;
}
interface Ride {
  id?: string;
  strava_id: string;
  ride_date: string | null;
  distance_km: number | null;
  duration_sec: number | null;
  avg_power_w: number | null;
}

function userId(): string | null {
  return useAuthStore.getState().userId;
}

/** Highest-priority connected HRV/sleep source for the current user. */
async function getActiveSource(): Promise<Source> {
  const id = userId();
  if (!id) return null;
  const { data } = await supabase
    .from('source_connections')
    .select('source, is_connected')
    .eq('user_id', id)
    .eq('is_connected', true);
  const connected = new Set((data ?? []).map((r) => r.source));
  if (connected.has('apple_health')) return 'apple_health';
  if (connected.has('garmin')) return 'garmin';
  if (connected.has('whoop')) return 'whoop';
  return null;
}

async function sinceDateISO(days: number): Promise<string> {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export const DataSource = {
  isMockMode(): boolean {
    return mockActive();
  },

  async getHRV(days = 30): Promise<HRVReading[]> {
    if (mockActive()) {
      console.log('[MOCK] Returning mock HRV data');
      return MockData.hrv(days);
    }
    const source = await getActiveSource();
    if (source === 'apple_health') return appleHealth.fetchHRVData(days);
    // garmin/whoop are synced to Supabase by the backend.
    const id = userId();
    if (!id) return [];
    const { data } = await supabase
      .from('hrv_readings')
      .select('recorded_at, hrv_ms, resting_hr, source')
      .eq('user_id', id)
      .gte('recorded_at', await sinceDateISO(days))
      .order('recorded_at', { ascending: false });
    return (data ?? []) as HRVReading[];
  },

  async getSleep(days = 30): Promise<SleepSession[]> {
    if (mockActive()) {
      console.log('[MOCK] Returning mock sleep data');
      return MockData.sleep(days);
    }
    const source = await getActiveSource();
    if (source === 'apple_health') return appleHealth.fetchSleepData(days) as unknown as Promise<SleepSession[]>;
    const id = userId();
    if (!id) return [];
    const since = (await sinceDateISO(days)).slice(0, 10);
    const { data } = await supabase
      .from('sleep_sessions')
      .select('date, duration_min, deep_min, rem_min, light_min, awake_min, sleep_score, source')
      .eq('user_id', id)
      .gte('date', since)
      .order('date', { ascending: false });
    return (data ?? []) as SleepSession[];
  },

  async getRecoveryScore(date: string): Promise<RecoveryScore | null> {
    if (mockActive()) {
      const scores = MockData.recovery(1);
      return (scores[0] as RecoveryScore) ?? null;
    }
    const id = userId();
    if (!id) return null;
    const { data } = await supabase
      .from('recovery_scores')
      .select('date, recovery_score, hrv_score, sleep_score, training_load_score, readiness_label, recommendation')
      .eq('user_id', id)
      .eq('date', date)
      .maybeSingle();
    return (data as RecoveryScore | null) ?? null;
  },

  async getRides(limit = 50): Promise<Ride[]> {
    if (mockActive()) {
      console.log('[MOCK] Returning mock rides');
      return MockData.rides(limit) as unknown as Ride[];
    }
    const { data } = await api.get<ApiResponse<Ride[]>>('/rides', { params: { limit } });
    return data.data ?? [];
  },
};
