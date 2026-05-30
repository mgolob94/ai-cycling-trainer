import { useState, useEffect, useCallback } from 'react';

import { api, apiOrigin, ApiResponse } from '../services/api';

export interface PdcEntry {
  duration_sec: number;
  duration_label: string;
  power_watts: number;
  achieved_date?: string | null;
}

interface CompareResponse {
  alltime: PdcEntry[];
  recent: PdcEntry[];
}

/** Power-duration curves: all-time, last ~90 days, and last ~30 days. */
export function usePowerCurve() {
  const [alltime, setAlltime] = useState<PdcEntry[]>([]);
  const [last90, setLast90] = useState<PdcEntry[]>([]);
  const [last30, setLast30] = useState<PdcEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [wide, narrow] = await Promise.all([
        api.get<ApiResponse<CompareResponse>>(`${apiOrigin}/pdc/compare?weeks=13`),
        api.get<ApiResponse<CompareResponse>>(`${apiOrigin}/pdc/compare?weeks=4`),
      ]);
      setAlltime(wide.data.data?.alltime ?? []);
      setLast90(wide.data.data?.recent ?? []);
      setLast30(narrow.data.data?.recent ?? []);
    } catch {
      // leave empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { alltime, last90, last30, loading, refresh };
}
