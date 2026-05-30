import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking as RNLinking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api, apiOrigin, ApiResponse } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing, radius, fontSize } from '../theme';
import CircularProgress from '../components/CircularProgress';

WebBrowser.maybeCompleteAuthSession();

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = 'support@cyclingaitrainer.app';
const POLL_INTERVAL_MS = 3000;

type Props = NativeStackScreenProps<AppStackParamList, 'StravaConnect'>;

interface Athlete {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
  profile_medium?: string;
}

interface SyncLog {
  sync_type?: string | null;
  status?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  activities_fetched?: number | null;
  activities_new?: number | null;
  error_message?: string | null;
  duration_sec?: number | null;
}

interface SyncStatus {
  sync_status: 'idle' | 'syncing' | 'completed' | 'error' | string;
  sync_error: string | null;
  initial_sync_completed: boolean;
  progress_percent: number;
  initial_sync_progress: number;
  initial_sync_total_estimate: number | null;
  total_activities_synced: number;
  total_rides: number;
  total_distance_km: number;
  first_ride_date: string | null;
  last_sync_at: string | null;
  new_activities_since_last_sync: number;
  last_sync_log: SyncLog | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------
function relativeTime(iso: string | null): string {
  if (!iso) return '—';
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.round(seconds)} s remaining`;
  return `~${Math.round(seconds / 60)} min remaining`;
}

const StravaMark = () => (
  <View style={styles.stravaMark}>
    <Text style={styles.stravaMarkText}>S</Text>
  </View>
);

export default function StravaConnectScreen(_props: Props) {
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Manual-sync (STATE 3 button) lifecycle.
  const [manualSyncing, setManualSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [syncFlash, setSyncFlash] = useState(false);

  // History accordion.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<SyncLog[] | null>(null);

  // ETA estimation samples: [timestampMs, progressCount].
  const etaSamples = useRef<Array<[number, number]>>([]);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const connected = athlete !== null;
  const syncing = status?.sync_status === 'syncing';
  const initialSyncing = syncing && !status?.initial_sync_completed;

  const fetchSyncStatus = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<SyncStatus>>(`${apiOrigin}/sync/status`);
      if (data.data) setStatus(data.data);
      return data.data ?? null;
    } catch {
      return null;
    }
  }, []);

  const refreshAthlete = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<{ connected: boolean; athlete: Athlete | null }>>(
        `${apiOrigin}/auth/strava/athlete`
      );
      if (data.data?.connected) setAthlete(data.data.athlete);
      else setAthlete(null);
    } catch {
      // Treat any failure as "not connected".
    }
  }, []);

  // -------------------------------------------------------------------------
  // Polling: every 3s while sync_status === 'syncing'; stops otherwise.
  // -------------------------------------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    pollTimer.current = setInterval(async () => {
      const next = await fetchSyncStatus();
      if (!next || (next.sync_status !== 'syncing')) {
        stopPolling();
        etaSamples.current = [];
      }
    }, POLL_INTERVAL_MS);
  }, [fetchSyncStatus, stopPolling]);

  // Track ETA samples + (re)start/stop polling as the status changes.
  useEffect(() => {
    if (syncing) {
      etaSamples.current.push([Date.now(), status?.initial_sync_progress ?? 0]);
      if (etaSamples.current.length > 8) etaSamples.current.shift();
      startPolling();
    } else {
      stopPolling();
    }
  }, [syncing, status?.initial_sync_progress, startPolling, stopPolling]);

  // Refresh on focus; the server keeps syncing in the background regardless, so
  // we just re-read status when the user returns to this screen.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        await refreshAthlete();
        const s = await fetchSyncStatus();
        if (active && s?.sync_status === 'syncing') startPolling();
        if (active) setChecking(false);
      })();
      return () => {
        active = false;
        stopPolling();
      };
    }, [refreshAthlete, fetchSyncStatus, startPolling, stopPolling])
  );

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------
  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        setError('You need to be signed in to connect Strava.');
        return;
      }
      const returnUrl = Linking.createURL('strava-callback');
      const authUrl =
        `${apiOrigin}/auth/strava?token=${encodeURIComponent(token)}` +
        `&return_url=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      if (result.type !== 'success' || !result.url) return; // dismissed

      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error) {
        setError('Strava authorization failed. Please try again.');
        return;
      }

      await refreshAthlete();
      // Kick off the one-time full import, then start polling for progress.
      await api.post(`${apiOrigin}/sync/initial`).catch(() => {});
      etaSamples.current = [];
      await fetchSyncStatus();
      startPolling();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to Strava.');
    } finally {
      setConnecting(false);
    }
  };

  const handleManualSync = async () => {
    setError(null);
    setSyncResult(null);
    setManualSyncing(true);
    const before = status?.total_rides ?? 0;
    try {
      await api.post(`${apiOrigin}/sync/manual`);
      etaSamples.current = [];
      // Poll until the sync settles, then report what changed.
      let settled = await fetchSyncStatus();
      let guard = 0;
      while (settled?.sync_status === 'syncing' && guard < 40) {
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
        settled = await fetchSyncStatus();
        guard += 1;
      }
      if (settled?.sync_status === 'error') {
        setError(settled.sync_error || 'Sync failed.');
      } else {
        const added = Math.max(0, (settled?.total_rides ?? before) - before);
        if (added > 0) {
          setSyncResult(`${added} new ${added === 1 ? 'activity' : 'activities'} added`);
          setSyncFlash(true);
          setTimeout(() => setSyncFlash(false), 1600);
        } else {
          setSyncResult('Everything is already up to date ✓');
        }
        if (historyOpen) loadHistory();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setManualSyncing(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleManualSync();
  };

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<SyncLog[]>>(`${apiOrigin}/sync/history`);
      setHistory((data.data ?? []).slice(0, 5));
    } catch {
      setHistory([]);
    }
  }, []);

  const toggleHistory = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next && history === null) loadHistory();
  };

  const reportProblem = () => {
    const subject = encodeURIComponent('Strava sync issue');
    const body = encodeURIComponent(`Error: ${status?.sync_error ?? error ?? 'unknown'}`);
    RNLinking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {});
  };

  // ETA: linear extrapolation from recent progress samples.
  const eta = (() => {
    if (!initialSyncing || !status?.initial_sync_total_estimate) return '';
    const s = etaSamples.current;
    if (s.length < 2) return '';
    const [t0, c0] = s[0];
    const [t1, c1] = s[s.length - 1];
    const dt = (t1 - t0) / 1000;
    const dc = c1 - c0;
    if (dt <= 0 || dc <= 0) return '';
    const speed = dc / dt; // activities/sec
    const remaining = Math.max(0, status.initial_sync_total_estimate - c1);
    return formatEta(remaining / speed);
  })();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (checking) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const avatarUri = athlete?.profile || athlete?.profile_medium;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ');

  // STATE 1 — not connected.
  if (!connected) {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.title}>Connect Strava</Text>
            <Text style={styles.mutedText}>
              Connect your Strava account to import all of your rides.
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.stravaButton, connecting && styles.buttonDisabled]}
              activeOpacity={0.85}
              disabled={connecting}
              onPress={handleConnect}
            >
              {connecting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.buttonRow}>
                  <StravaMark />
                  <Text style={styles.primaryButtonText}>Connect with Strava</Text>
                </View>
              )}
            </TouchableOpacity>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // STATE 2 — initial sync in progress (cannot be cancelled).
  if (initialSyncing) {
    const done = status?.initial_sync_progress ?? 0;
    const est = status?.initial_sync_total_estimate ?? null;
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <View style={styles.syncingWrap}>
          <CircularProgress
            percent={status?.progress_percent ?? 0}
            caption={est ? 'imported' : undefined}
            label={est ? undefined : `${done}`}
          />
          <Text style={styles.syncingTitle}>Importing your activities…</Text>
          <Text style={styles.mutedText}>
            {est ? `${done} of ~${est} activities` : `${done} activities so far`}
          </Text>
          {eta ? <Text style={styles.etaText}>{eta}</Text> : null}
          <View style={styles.noticeCard}>
            <Text style={styles.noticeText}>
              The first import brings in your entire history and can't be cancelled. You can
              leave this screen — syncing continues in the background.
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // STATE 4 — sync error.
  if (status?.sync_status === 'error') {
    return (
      <SafeAreaView style={styles.safe} edges={['bottom']}>
        <View style={styles.container}>
          <View style={styles.hero}>
            <View style={styles.errorCard}>
              <Text style={styles.errorCardTitle}>Sync failed</Text>
              <Text style={styles.errorCardBody}>
                {status?.sync_error || 'Something went wrong while syncing with Strava.'}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.stravaButton, manualSyncing && styles.buttonDisabled]}
              activeOpacity={0.85}
              disabled={manualSyncing}
              onPress={handleRetry}
            >
              {manualSyncing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Try again</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={reportProblem}>
              <Text style={styles.linkText}>Report a problem</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // STATE 3 — connected and synced.
  const syncBtnContent = manualSyncing ? (
    <View style={styles.buttonRow}>
      <ActivityIndicator color="#fff" />
      <Text style={styles.primaryButtonText}>Syncing…</Text>
    </View>
  ) : (
    <View style={styles.buttonRow}>
      <StravaMark />
      <Text style={styles.primaryButtonText}>Sync new activities</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.profileCard}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {(athlete?.firstname?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.connectedRow}>
            <Text style={styles.checkmark}>✓</Text>
            <Text style={styles.name}>Strava connected</Text>
          </View>
          {fullName ? <Text style={styles.mutedText}>{fullName}</Text> : null}

          <Text style={styles.statsRow}>
            {`${status?.total_rides ?? 0} activities • ${status?.total_distance_km ?? 0} km total`}
            {status?.first_ride_date ? ` • since ${formatDate(status.first_ride_date)}` : ''}
          </Text>
          <Text style={styles.lastSync}>Last sync: {relativeTime(status?.last_sync_at ?? null)}</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[
              styles.stravaButton,
              manualSyncing && styles.buttonDisabled,
              syncFlash && styles.successButton,
            ]}
            activeOpacity={0.85}
            disabled={manualSyncing}
            onPress={handleManualSync}
          >
            {syncFlash ? (
              <Text style={styles.primaryButtonText}>{syncResult}</Text>
            ) : (
              syncBtnContent
            )}
          </TouchableOpacity>
          {!syncFlash && syncResult ? (
            <Text style={styles.successText}>{syncResult}</Text>
          ) : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        {/* Sync history accordion */}
        <View style={styles.historyCard}>
          <TouchableOpacity style={styles.historyHeader} onPress={toggleHistory} activeOpacity={0.7}>
            <Text style={styles.historyTitle}>Sync history</Text>
            <Text style={styles.chevron}>{historyOpen ? '▴' : '▾'}</Text>
          </TouchableOpacity>
          {historyOpen ? (
            history === null ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.md }} />
            ) : history.length === 0 ? (
              <Text style={styles.mutedText}>No syncs yet.</Text>
            ) : (
              history.map((h, i) => (
                <View key={i} style={styles.historyItem}>
                  <View style={styles.historyItemMain}>
                    <Text style={styles.historyType}>
                      {h.sync_type === 'initial' ? 'Initial import' : 'Sync'}
                      {h.status === 'error' ? ' · failed' : ''}
                    </Text>
                    <Text style={styles.historyMeta}>{relativeTime(h.started_at ?? null)}</Text>
                  </View>
                  <Text style={styles.historyCount}>
                    {h.status === 'error'
                      ? '—'
                      : `${h.activities_new ?? h.activities_fetched ?? 0} new`}
                  </Text>
                </View>
              ))
            )
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  hero: { flex: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22, textAlign: 'center' },

  // Buttons
  actions: { gap: spacing.sm },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stravaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successButton: { backgroundColor: colors.accent },
  buttonDisabled: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  stravaMark: {
    width: 22,
    height: 22,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stravaMarkText: { color: '#fff', fontWeight: '900', fontSize: fontSize.sm },
  linkText: { color: colors.textMuted, textAlign: 'center', fontSize: fontSize.sm, paddingVertical: spacing.sm, textDecorationLine: 'underline' },
  successText: { color: colors.accent, fontSize: fontSize.sm, textAlign: 'center' },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },

  // STATE 2 — syncing
  syncingWrap: { alignItems: 'center', padding: spacing.lg, gap: spacing.md },
  syncingTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', marginTop: spacing.md },
  etaText: { color: colors.accent, fontSize: fontSize.sm },
  noticeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noticeText: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center' },

  // STATE 3 — connected
  profileCard: { alignItems: 'center', gap: spacing.xs },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  checkmark: { color: colors.accent, fontSize: fontSize.lg, fontWeight: '900' },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700' },
  statsRow: { color: colors.text, fontSize: fontSize.sm, textAlign: 'center', marginTop: spacing.sm },
  lastSync: { color: colors.textMuted, fontSize: fontSize.sm },

  // STATE 4 — error
  errorCard: {
    backgroundColor: 'rgba(255,84,112,0.12)',
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  errorCardTitle: { color: colors.danger, fontSize: fontSize.lg, fontWeight: '800' },
  errorCardBody: { color: colors.text, fontSize: fontSize.md, lineHeight: 22 },

  // History accordion
  historyCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  historyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md },
  historyTitle: { color: colors.text, fontSize: fontSize.md, fontWeight: '700' },
  chevron: { color: colors.textMuted, fontSize: fontSize.md },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  historyItemMain: { gap: 2 },
  historyType: { color: colors.text, fontSize: fontSize.sm, fontWeight: '600' },
  historyMeta: { color: colors.textMuted, fontSize: fontSize.sm - 1 },
  historyCount: { color: colors.accent, fontSize: fontSize.sm, fontWeight: '700' },
});
