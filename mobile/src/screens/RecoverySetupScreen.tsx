import { useCallback, useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { Feather } from '@expo/vector-icons';

import { apiOrigin } from '../services/api';
import { supabase } from '../services/supabase';
import { useAuthStore } from '../store/useAuthStore';
import * as appleHealth from '../services/appleHealth';
import { markRecoverySetupSeen } from '../services/recoverySetup';
import { Text, Card, Button, Emoji } from '../components/ui';
import { palette, spacing, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from '../navigation/types';

WebBrowser.maybeCompleteAuthSession();

type Nav = NativeStackNavigationProp<AppStackParamList>;
type SourceKey = 'apple_health' | 'garmin' | 'whoop';

const SOURCES: { key: SourceKey; name: string; desc: string; connectLabel: string }[] = [
  { key: 'apple_health', name: 'Apple Health', desc: 'Automatically from iPhone or Apple Watch', connectLabel: 'Connect Apple Health' },
  { key: 'garmin', name: 'Garmin Connect', desc: 'From a Garmin watch (Forerunner, Fenix, Venu…)', connectLabel: 'Connect Garmin' },
  { key: 'whoop', name: 'Whoop', desc: 'From a Whoop strap', connectLabel: 'Connect Whoop' },
];

const MOODS = [
  { emoji: '😴', label: 'Exhausted' },
  { emoji: '😕', label: 'Tired' },
  { emoji: '😐', label: 'OK' },
  { emoji: '😊', label: 'Good' },
  { emoji: '⚡', label: 'Great' },
];

export default function RecoverySetupScreen() {
  const navigation = useNavigation<Nav>();
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.userId);

  const [step, setStep] = useState(1);
  const [connected, setConnected] = useState<Record<SourceKey, boolean>>({ apple_health: false, garmin: false, whoop: false });
  const [busy, setBusy] = useState<SourceKey | null>(null);
  const [mood, setMood] = useState<number | null>(null);

  const refreshConnected = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('source_connections').select('source, is_connected').eq('user_id', userId);
    const next: Record<SourceKey, boolean> = { apple_health: false, garmin: false, whoop: false };
    for (const r of data ?? []) if (r.source in next) next[r.source as SourceKey] = !!r.is_connected;
    setConnected(next);
  }, [userId]);

  useEffect(() => {
    refreshConnected();
  }, [refreshConnected]);

  const anyConnected = connected.apple_health || connected.garmin || connected.whoop;

  const finish = async () => {
    await markRecoverySetupSeen();
    navigation.navigate('Tabs', { screen: 'Recovery' });
  };

  const connectApple = async () => {
    if (!userId) return;
    setBusy('apple_health');
    try {
      const r = await appleHealth.syncToDatabase(userId);
      if (!r.available) {
        Alert.alert('Apple Health unavailable', 'Apple Health needs an iOS device with a development build.');
        return;
      }
      setConnected((c) => ({ ...c, apple_health: true }));
    } finally {
      setBusy(null);
    }
  };

  const connectOAuth = async (src: 'garmin' | 'whoop') => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setBusy(src);
    try {
      const returnUrl = Linking.createURL('recovery-callback');
      const url =
        `${apiOrigin}/integrations/${src}/auth?token=${encodeURIComponent(token)}` +
        `&return_url=${encodeURIComponent(returnUrl)}`;
      const res = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (res.type === 'success') await refreshConnected();
    } finally {
      setBusy(null);
    }
  };

  const onConnect = (src: SourceKey) => (src === 'apple_health' ? connectApple() : connectOAuth(src));

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* STEP 1 — why */}
        {step === 1 ? (
          <View style={styles.step}>
            <Emoji style={styles.hero}>🔋</Emoji>
            <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
              Recovery is half of training
            </Text>
            <Text variant="bodyLarge" color={colors.textSecondary} style={styles.body}>
              Riders who track recovery progress about twice as fast. Without data we can't tell you when to push and
              when to rest.
            </Text>
            <Card variant="tinted" style={styles.balanceCard}>
              <View style={styles.balanceRow}>
                <View style={styles.balanceSide}>
                  <Text variant="label" color={colors.accent}>
                    TRAINING LOAD
                  </Text>
                  <View style={[styles.balanceBar, { backgroundColor: palette.emerald400 }]} />
                </View>
                <Feather name="repeat" size={18} color={colors.textTertiary} />
                <View style={styles.balanceSide}>
                  <Text variant="label" color={palette.emerald600}>
                    RECOVERY
                  </Text>
                  <View style={[styles.balanceBar, { backgroundColor: palette.emerald400 }]} />
                </View>
              </View>
              <Text variant="caption" color={colors.textSecondary} style={styles.balanceHint}>
                Progress comes from balancing the two.
              </Text>
            </Card>
            <Button label="Continue" variant="primary" size="lg" onPress={() => setStep(2)} style={styles.cta} />
          </View>
        ) : null}

        {/* STEP 2 — choose a source */}
        {step === 2 ? (
          <View style={styles.step}>
            <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
              Where do you read HRV and sleep?
            </Text>
            <View style={styles.sourceList}>
              {SOURCES.map((s) => {
                const isConnected = connected[s.key];
                return (
                  <Card key={s.key} variant="default" style={styles.sourceCard}>
                    <View style={styles.sourceHead}>
                      <Text variant="heading3" color={colors.textPrimary}>
                        {s.name}
                      </Text>
                      {isConnected ? (
                        <View style={styles.connectedTag}>
                          <Feather name="check" size={14} color={palette.emerald600} />
                          <Text variant="caption" color={palette.emerald600} style={styles.bold}>
                            Connected
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text variant="caption" color={colors.textSecondary} style={styles.sourceDesc}>
                      {s.desc}
                    </Text>
                    {!isConnected ? (
                      <Button
                        label={s.connectLabel}
                        variant="secondary"
                        size="sm"
                        loading={busy === s.key}
                        onPress={() => onConnect(s.key)}
                        style={styles.sourceBtn}
                      />
                    ) : null}
                  </Card>
                );
              })}
            </View>

            {anyConnected ? (
              <Button label="Continue" variant="primary" size="lg" onPress={finish} style={styles.cta} />
            ) : null}
            <Pressable onPress={() => setStep(3)} hitSlop={8} style={styles.skip}>
              <Text variant="caption" color={colors.textSecondary}>
                Skip — I'll enter it manually
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* STEP 3 — manual fallback */}
        {step === 3 ? (
          <View style={styles.step}>
            <Text variant="heading1" color={colors.textPrimary} style={styles.title}>
              How do you feel in the morning?
            </Text>
            <Text variant="bodyLarge" color={colors.textSecondary} style={styles.body}>
              No device? We can still help — just tell us how you feel.
            </Text>
            <View style={styles.moodRow}>
              {MOODS.map((m, i) => {
                const active = mood === i;
                return (
                  <Pressable key={m.label} style={styles.mood} onPress={() => setMood(i)}>
                    <View style={[styles.moodCircle, active && { backgroundColor: colors.surfaceRaised, borderColor: palette.emerald400 }]}>
                      <Emoji size={28}>{m.emoji}</Emoji>
                    </View>
                    <Text variant="caption" color={active ? colors.textPrimary : colors.textSecondary}>
                      {m.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text variant="caption" color={colors.textSecondary} style={styles.body}>
              Every morning we'll ask how you feel and adapt your training based on it.
            </Text>
            <Button label="Let's go →" variant="primary" size="lg" onPress={finish} style={styles.cta} />
          </View>
        ) : null}

        {busy && step === 2 ? <ActivityIndicator color={colors.accent} style={styles.spinner} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: spacing[5], paddingBottom: spacing[10], flexGrow: 1, justifyContent: 'center' },
  step: { gap: spacing[4] },
  hero: { fontSize: 56, alignSelf: 'center' },
  title: { lineHeight: 38 },
  body: { lineHeight: 26 },
  cta: { marginTop: spacing[2] },

  balanceCard: { gap: spacing[3] },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  balanceSide: { flex: 1, gap: spacing[2] },
  balanceBar: { height: 10, borderRadius: radius.full },
  balanceHint: { textAlign: 'center' },

  sourceList: { gap: spacing[3] },
  sourceCard: { gap: spacing[2] },
  sourceHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  connectedTag: { flexDirection: 'row', alignItems: 'center', gap: spacing[1] },
  sourceDesc: { lineHeight: 19 },
  sourceBtn: { marginTop: spacing[2] },
  bold: { fontWeight: '700' },

  skip: { alignSelf: 'center', paddingVertical: spacing[3] },

  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mood: { alignItems: 'center', gap: spacing[1], flex: 1 },
  moodCircle: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },

  spinner: { marginTop: spacing[4] },
});
