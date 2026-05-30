import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, apiOrigin, ApiResponse } from '../services/api';
import type { WeeklyMetric } from './useWeeklyMetrics';
import type { PersonalRecord } from './usePersonalRecords';
import type { FtpTest } from './useFtp';

export type { WeeklyMetric, PersonalRecord, FtpTest };

const CACHE_KEY = 'progress_cache_v1';

interface ProgressData {
  metrics: WeeklyMetric[];
  records: PersonalRecord[];
  ftpHistory: FtpTest[];
}

const EMPTY: ProgressData = { metrics: [], records: [], ftpHistory: [] };

async function readCache(): Promise<ProgressData | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as ProgressData) : null;
  } catch {
    return null;
  }
}

async function writeCache(data: ProgressData): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Non-fatal: caching is best-effort.
  }
}

/**
 * Aggregates the progress data (weekly metrics, personal records, FTP history)
 * behind one hook. Hydrates from an AsyncStorage cache first so data is visible
 * offline / instantly, then refreshes from the network and re-caches. A network
 * failure surfaces via `error` while keeping the cached data on screen.
 */
export function useProgress() {
  const [data, setData] = useState<ProgressData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Show cached data immediately (offline-friendly first paint).
    const cached = await readCache();
    if (cached) setData(cached);

    try {
      const [metricsRes, recordsRes, ftpRes] = await Promise.all([
        api.get<ApiResponse<WeeklyMetric[]>>(`${apiOrigin}/metrics/weekly`),
        api.get<ApiResponse<PersonalRecord[]>>(`${apiOrigin}/records`),
        api.get<ApiResponse<FtpTest[]>>(`${apiOrigin}/ftp/history`),
      ]);

      const fresh: ProgressData = {
        metrics: metricsRes.data.data ?? [],
        records: recordsRes.data.data ?? [],
        ftpHistory: ftpRes.data.data ?? [],
      };

      setData(fresh);
      await writeCache(fresh);
    } catch (e) {
      // Keep whatever cached data we have; just report the failure.
      setError(e instanceof Error ? e.message : 'Failed to load progress data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    metrics: data.metrics,
    records: data.records,
    ftpHistory: data.ftpHistory,
    loading,
    error,
    refresh,
  };
}
