import { useState, useEffect, useCallback } from 'react';

import { api, ApiResponse } from '../services/api';

export interface UserProfile {
  email: string;
  age: number | null;
  weight_kg: number | null;
  goal: string | null;
  w_prime_total: number | null;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<ApiResponse<UserProfile>>('/users/me');
      setProfile(data.data ?? null);
    } catch {
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, refresh };
}
