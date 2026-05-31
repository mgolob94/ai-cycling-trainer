import { useCallback, useEffect, useState } from 'react';

import { api, type ApiResponse } from '../services/api';

export interface RideFeedback {
  completion_status: string | null;
  perceived_effort: number | null;
  post_feeling: number | null;
  coach_feedback: string | null;
  coach_feedback_generated_at: string | null;
  progress_signal: string | null;
}

/** Loads the stored survey + coach feedback for a ride (GET /rides/:id/feedback). */
export function useRideFeedback(stravaId: string) {
  const [feedback, setFeedback] = useState<RideFeedback | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiResponse<RideFeedback | null>>(`/rides/${stravaId}/feedback`);
      setFeedback(data.data ?? null);
    } catch {
      setFeedback(null);
    } finally {
      setLoading(false);
    }
  }, [stravaId]);

  useEffect(() => {
    load();
  }, [load]);

  return { feedback, loading, refetch: load };
}
