import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { supabase } from '../../services/supabase';
import { api, apiOrigin, setAuthToken } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { markStravaSkipped, clearStravaSkipped } from '../../services/stravaOnboarding';
import * as appleHealth from '../../services/appleHealth';
import { useFlagStore } from '../../config/featureFlags';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, radius, fontSize } from '../../theme';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<AuthStackParamList, 'StravaSetup'>;

type Stage = 'choose' | 'connecting' | 'success';

export default function StravaSetupScreen(_props: Props) {
  const setSession = useAuthStore((state) => state.setSession);

  const [stage, setStage] = useState<Stage>('choose');
  const [error, setError] = useState<string | null>(null);

  // The user just signed up but we deferred storing the session (which flips to
  // the app stack) until they finish this step. Hold the creds locally and wire
  // the axios auth header so the /sync calls below are authenticated.
  const creds = useRef<{ token: string; userId: string } | null>(null);

  useEffect(() => {
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        creds.current = { token: session.access_token, userId: session.user.id };
        setAuthToken(session.access_token);
      }
    })();
  }, []);

  /** Mark onboarding complete (+ kick off the first plan), then store the
   *  session → flips navigation over to the app (Dashboard). */
  const finishOnboarding = () => {
    const c = creds.current;
    if (!c) return;
    setAuthToken(c.token);
    api.post(`${apiOrigin}/onboarding/complete`).catch(() => {});
    setSession(c.token, c.userId);
  };

  const handleConnect = async () => {
    setError(null);
    const c = creds.current;
    if (!c) {
      setError('Your session expired. Please sign in again.');
      return;
    }
    setStage('connecting');
    try {
      const returnUrl = Linking.createURL('strava-callback');
      const authUrl =
        `${apiOrigin}/auth/strava?token=${encodeURIComponent(c.token)}` +
        `&return_url=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
      if (result.type !== 'success' || !result.url) {
        setStage('choose'); // dismissed/cancelled
        return;
      }
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error) {
        setError('Strava authorization failed. Please try again.');
        setStage('choose');
        return;
      }

      // Connected — clear any prior skip flag and kick off the historical import
      // in the background, then drop the user onto the dashboard.
      await clearStravaSkipped();
      await api.post(`${apiOrigin}/sync/initial`).catch(() => {});
      // Silently set up Apple Health (iOS physical device only) — no dedicated
      // screen. iOS shows its own permission dialog; if denied we continue fine.
      if (useFlagStore.getState().flags.apple_health_sync) {
        appleHealth.syncToDatabase(creds.current?.userId ?? '').catch(() => {});
      }
      setStage('success');
      setTimeout(finishOnboarding, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect to Strava.');
      setStage('choose');
    }
  };

  const handleSkip = async () => {
    await markStravaSkipped();
    finishOnboarding();
  };

  if (stage === 'success') {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['bottom']}>
        <Text style={styles.emoji}>🚴</Text>
        <Text style={styles.successTitle}>Awesome! We're importing your rides in the background</Text>
        <Text style={styles.subtitle}>Meanwhile, we're preparing your first workout…</Text>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.step}>Step 4 of 4</Text>
          <Text style={styles.title}>Connect your Strava</Text>
          <Text style={styles.subtitle}>
            We'll pull your ride history and use it to build your first plan. The more rides you have, the smarter your coach gets.
          </Text>
        </View>

        <View style={styles.actions}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <TouchableOpacity
            style={[styles.stravaButton, stage === 'connecting' && styles.buttonDisabled]}
            activeOpacity={0.85}
            disabled={stage === 'connecting'}
            onPress={handleConnect}
          >
            {stage === 'connecting' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.buttonRow}>
                <View style={styles.stravaMark}>
                  <Text style={styles.stravaMarkText}>S</Text>
                </View>
                <Text style={styles.primaryButtonText}>Connect Strava</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleSkip} disabled={stage === 'connecting'} hitSlop={8}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  hero: { flex: 1, justifyContent: 'center' },
  step: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '700', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22, textAlign: 'center' },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  successTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: '800', textAlign: 'center', marginBottom: spacing.sm },

  actions: { gap: spacing.md, alignItems: 'center' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  stravaButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
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
  skipText: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', paddingVertical: spacing.sm },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
});
