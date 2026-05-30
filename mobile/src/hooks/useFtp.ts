import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface FtpTest {
  ftp_watts: number;
  watts_per_kg: number | null;
  weight_kg: number | null;
  test_date: string;
  created_at?: string;
}

/** Current FTP + test history, plus a runTest action that recalculates. */
export function useFtp() {
  const [ftp, setFtp] = useState<FtpTest | null>(null);
  const [history, setHistory] = useState<FtpTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [latestRes, historyRes] = await Promise.all([
        api.get<ApiResponse<FtpTest | null>>(`${apiOrigin}/ftp/latest`),
        api.get<ApiResponse<FtpTest[]>>(`${apiOrigin}/ftp/history`),
      ]);
      setFtp(latestRes.data.data ?? null);
      setHistory(historyRes.data.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load FTP.');
    } finally {
      setLoading(false);
    }
  }, []);

  const runTest = useCallback(async () => {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const { data } = await api.post<ApiResponse<{ ftp_watts: number; recorded?: boolean } | null>>(
        `${apiOrigin}/ftp/calculate`
      );
      const result = data.data;
      if (result) {
        setNotice(
          result.recorded
            ? `Updated — new FTP ${result.ftp_watts} W`
            : `No change — FTP still ${result.ftp_watts} W. Sync more rides to improve it.`
        );
      }
      await refresh();
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        (e instanceof Error ? e.message : 'FTP test failed.');
      setError(msg);
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ftp, history, loading, running, error, notice, refresh, runTest };
}
