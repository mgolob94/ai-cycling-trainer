import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface PersonalRecord {
  record_type: string;
  value: number;
  unit: string;
  strava_activity_id: string | null;
  achieved_date: string | null;
}

/** Current personal records, with a scan action to rescan all rides. */
export function usePersonalRecords() {
  const [records, setRecords] = useState<PersonalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await api.get<ApiResponse<PersonalRecord[]>>(`${apiOrigin}/records`);
      setRecords(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records.');
    } finally {
      setLoading(false);
    }
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const { data } = await api.post<ApiResponse<PersonalRecord[]>>(`${apiOrigin}/records/scan`);
      setRecords(data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to scan records.');
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { records, loading, scanning, error, refresh, scan };
}
