import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api, apiOrigin, type ApiResponse } from '../services/api';

export type FlagKey =
  | 'recovery_screen'
  | 'coach_chat'
  | 'monthly_review'
  | 'power_duration_curve'
  | 'nutrition_screen'
  | 'strength_in_plan'
  | 'morning_checkin'
  | 'apple_health_sync';

type Flags = Record<FlagKey, boolean>;

// Mirror of the backend defaults — used until/if the server responds.
const DEFAULTS: Flags = {
  recovery_screen: false,
  coach_chat: false,
  monthly_review: false,
  power_duration_curve: false,
  nutrition_screen: true,
  strength_in_plan: true,
  morning_checkin: true,
  apple_health_sync: true,
};

const STORAGE_KEY = '@feature_flags';

interface FlagState {
  flags: Flags;
  load: () => Promise<void>;
}

export const useFlagStore = create<FlagState>((set) => ({
  flags: DEFAULTS,
  load: async () => {
    // 1) Hydrate from cache for instant, offline-safe startup.
    try {
      const cached = await AsyncStorage.getItem(STORAGE_KEY);
      if (cached) set({ flags: { ...DEFAULTS, ...JSON.parse(cached) } });
    } catch {
      // ignore
    }
    // 2) Refresh from the server and re-cache.
    try {
      const { data } = await api.get<ApiResponse<Partial<Flags>>>(`${apiOrigin}/config/flags`);
      if (data?.data) {
        const next = { ...DEFAULTS, ...data.data };
        set({ flags: next });
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data.data)).catch(() => {});
      }
    } catch {
      // keep cached/defaults
    }
  },
}));

/** Reactive accessor for a single feature flag. */
export function useFeatureFlag(key: FlagKey): boolean {
  return useFlagStore((s) => s.flags[key] ?? false);
}

/** Load flags once on app start. */
export function loadFeatureFlags() {
  return useFlagStore.getState().load();
}
