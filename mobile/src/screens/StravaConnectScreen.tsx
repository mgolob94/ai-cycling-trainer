import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { api, apiOrigin, ApiResponse } from '../services/api';
import { useAuthStore } from '../store/useAuthStore';
import type { AppStackParamList } from '../navigation/types';
import { colors, spacing, radius, fontSize } from '../theme';

// Dismiss the auth browser automatically when the redirect comes back.
WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AppStackParamList, 'StravaConnect'>;

interface Athlete {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
  profile_medium?: string;
}

interface StravaStatus {
  connected: boolean;
  athlete: Athlete | null;
}

export default function StravaConnectScreen(_props: Props) {
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const connected = athlete !== null;

  // On mount, ask the backend whether this user already linked Strava.
  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.get<ApiResponse<StravaStatus>>(
        `${apiOrigin}/auth/strava/athlete`
      );
      if (data.data?.connected) {
        setAthlete(data.data.athlete);
      }
    } catch {
      // Treat any failure here as "not connected"; the connect button stays.
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      const token = useAuthStore.getState().token;
      if (!token) {
        setError('You need to be signed in to connect Strava.');
        return;
      }

      // Backend-mediated OAuth: Strava only accepts http(s) redirect URIs under a
      // registered domain, so we open the backend's /auth/strava entry point. It
      // redirects to Strava, handles the callback, stores tokens, and bounces
      // back to our deep link (passed as return_url).
      const returnUrl = Linking.createURL('strava-callback');
      const authUrl =
        `${apiOrigin}/auth/strava?token=${encodeURIComponent(token)}` +
        `&return_url=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);

      if (result.type !== 'success' || !result.url) {
        // User dismissed/cancelled the browser — nothing to show.
        return;
      }

      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error) {
        setError('Strava authorization failed. Please try again.');
        return;
      }

      // Backend already stored the tokens; refresh status to show the profile.
      await refreshStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to Strava.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setSyncMessage(null);
    setSyncing(true);
    try {
      const { data } = await api.post<ApiResponse<{ synced: number }>>(
        `${apiOrigin}/sync/strava`
      );
      setSyncMessage(`Synced ${data.data?.synced ?? 0} rides.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  if (checking) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const avatarUri = athlete?.profile || athlete?.profile_medium;
  const fullName = [athlete?.firstname, athlete?.lastname].filter(Boolean).join(' ');

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        {connected ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.connectedBadge}>
                <Text style={styles.connectedBadgeText}>✓ Connected</Text>
              </View>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>
                    {(athlete?.firstname?.[0] ?? '?').toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.name}>{fullName || 'Strava athlete'}</Text>
              <Text style={styles.mutedText}>Your Strava account is linked.</Text>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.primaryButton, syncing && styles.buttonDisabled]}
                activeOpacity={0.85}
                disabled={syncing}
                onPress={handleSync}
              >
                {syncing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Sync rides</Text>
                )}
              </TouchableOpacity>
              {syncMessage ? <Text style={styles.successText}>{syncMessage}</Text> : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <Text style={styles.title}>Connect Strava</Text>
              <Text style={styles.mutedText}>
                Link your Strava account so we can analyze your rides and build your
                training plan.
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
                  <Text style={styles.primaryButtonText}>Connect with Strava</Text>
                )}
              </TouchableOpacity>
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center' },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
  mutedText: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  profileCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  connectedBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginBottom: spacing.md,
  },
  connectedBadgeText: { color: colors.accent, fontWeight: '700', fontSize: fontSize.sm },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surface },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: '700', marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stravaButton: {
    backgroundColor: '#FC4C02',
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  successText: { color: colors.accent, fontSize: fontSize.sm, textAlign: 'center' },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
});
