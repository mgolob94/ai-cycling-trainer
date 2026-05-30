import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { api, apiOrigin, type ApiResponse } from '../services/api';

// Poll cadence: relaxed when idle, tight while a sync is actively running.
const IDLE_INTERVAL_MS = 30_000;
const SYNCING_INTERVAL_MS = 3_000;

interface SyncStatusPayload {
  connected: boolean;
  sync_status: string;
  sync_error: string | null;
  last_sync_at: string | null;
  total_rides: number;
  progress_percent: number;
  initial_sync_completed: boolean;
}

export interface SyncStatusState {
  connected: boolean;
  isSyncing: boolean;
  /** The one-time historical import is running (vs. an incremental sync). */
  isInitialSyncing: boolean;
  /** 0–100 progress of the initial import. */
  progressPercent: number;
  lastSyncAt: string | null;
  /** A new activity arrived (e.g. via webhook) since the UI last acknowledged. */
  newActivitiesAvailable: boolean;
  syncError: string | null;
  /** Clear the "new activities" flag (call after the UI reloads its data). */
  acknowledge: () => void;
  /** Force an immediate status fetch. */
  refreshNow: () => Promise<void>;
}

/**
 * Polls GET /sync/status and exposes a compact view of sync state for header
 * indicators. Polls every 30s while idle, every 3s while syncing, and pauses
 * entirely while the app is backgrounded (resuming with an immediate fetch).
 *
 * `newActivitiesAvailable` flips true when the server's ride count grows beyond
 * the last acknowledged baseline — i.e. a webhook imported a ride while the user
 * was looking at the app — and stays true until acknowledge() is called.
 */
export function useSyncStatus(): SyncStatusState {
  const [connected, setConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isInitialSyncing, setIsInitialSyncing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [newActivitiesAvailable, setNewActivitiesAvailable] = useState(false);

  const baselineRides = useRef<number | null>(null);
  const latestRides = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);

  const poll = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<SyncStatusPayload>>(`${apiOrigin}/sync/status`);
      const s = data.data;
      if (!s) return;

      setConnected(!!s.connected);
      setIsSyncing(s.sync_status === 'syncing');
      setIsInitialSyncing(s.sync_status === 'syncing' && !s.initial_sync_completed);
      setProgressPercent(s.progress_percent ?? 0);
      setLastSyncAt(s.last_sync_at ?? null);
      setSyncError(s.sync_status === 'error' ? s.sync_error ?? 'Sync failed' : null);

      latestRides.current = s.total_rides ?? 0;
      if (baselineRides.current === null) {
        // First reading establishes the baseline — nothing is "new" yet.
        baselineRides.current = latestRides.current;
      } else if (latestRides.current > baselineRides.current) {
        setNewActivitiesAvailable(true);
      }
    } catch {
      // Network blips are non-fatal; the next tick retries.
    }
  }, []);

  const acknowledge = useCallback(() => {
    baselineRides.current = latestRides.current;
    setNewActivitiesAvailable(false);
  }, []);

  // (Re)schedule the poll loop whenever the cadence (idle vs syncing) changes,
  // and pause/resume it with the foreground/background app state.
  useEffect(() => {
    const clear = () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
    const schedule = () => {
      clear();
      if (appState.current !== 'active') return;
      timer.current = setInterval(poll, isSyncing ? SYNCING_INTERVAL_MS : IDLE_INTERVAL_MS);
    };

    schedule();

    const sub = AppState.addEventListener('change', (next) => {
      const prev = appState.current;
      appState.current = next;
      if (next === 'active') {
        if (prev !== 'active') poll(); // immediate catch-up on resume
        schedule();
      } else {
        clear();
      }
    });

    return () => {
      clear();
      sub.remove();
    };
  }, [isSyncing, poll]);

  // Kick off an initial fetch on mount.
  useEffect(() => {
    poll();
  }, [poll]);

  return {
    connected,
    isSyncing,
    isInitialSyncing,
    progressPercent,
    lastSyncAt,
    newActivitiesAvailable,
    syncError,
    acknowledge,
    refreshNow: poll,
  };
}
