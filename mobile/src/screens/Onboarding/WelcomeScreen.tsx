import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useDemoStore } from '../../store/useDemoStore';
import type { AuthStackParamList } from '../../navigation/types';
import { colors, spacing, radius, fontSize } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParamList, 'Welcome'>;

const DEMO_LIMITS = [
  { ok: true, text: 'All features visible' },
  { ok: true, text: 'Realistic data' },
  { ok: false, text: "Data isn't saved" },
  { ok: false, text: 'No Strava sync' },
  { ok: false, text: 'Workouts not personalized' },
];

export default function WelcomeScreen({ navigation }: Props) {
  const enterDemo = useDemoStore((s) => s.enterDemo);
  const [showDemoModal, setShowDemoModal] = useState(false);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.badge}>AI POWERED</Text>
          <Text style={styles.title}>Ride smarter.</Text>
          <Text style={styles.title}>
            Train with <Text style={styles.titleAccent}>AI</Text>.
          </Text>
          <Text style={styles.subtitle}>
            Personalized weekly cycling plans built from your real Strava rides, your
            fitness, and your goals.
          </Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SignUp')}
          >
            <Text style={styles.primaryButtonText}>Get started</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.ghostButton}
            activeOpacity={0.7}
            onPress={() => setShowDemoModal(true)}
          >
            <Text style={styles.ghostButtonText}>View demo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.secondaryButtonText}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Demo-mode limitations */}
      <Modal visible={showDemoModal} transparent animationType="fade" onRequestClose={() => setShowDemoModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Demo mode</Text>
            <Text style={styles.modalSub}>Explore the full app with simulated data — no signup needed.</Text>
            <View style={styles.limits}>
              {DEMO_LIMITS.map((l) => (
                <View key={l.text} style={styles.limitRow}>
                  <Text style={[styles.limitMark, { color: l.ok ? colors.accent : colors.danger }]}>
                    {l.ok ? '✓' : '✕'}
                  </Text>
                  <Text style={styles.limitText}>{l.text}</Text>
                </View>
              ))}
            </View>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => {
                setShowDemoModal(false);
                enterDemo();
              }}
            >
              <Text style={styles.primaryButtonText}>Enter demo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowDemoModal(false)}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center' },
  badge: {
    color: colors.accent,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  title: { color: colors.text, fontSize: fontSize.xxl, fontWeight: '800', lineHeight: 40 },
  titleAccent: { color: colors.primary },
  subtitle: {
    color: colors.textMuted,
    fontSize: fontSize.md,
    lineHeight: 24,
    marginTop: spacing.md,
  },
  actions: { gap: spacing.md },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: fontSize.md, fontWeight: '700' },
  ghostButton: { paddingVertical: 12, alignItems: 'center' },
  ghostButtonText: { color: colors.accent, fontSize: fontSize.md, fontWeight: '700' },
  secondaryButton: { paddingVertical: 14, alignItems: 'center' },
  secondaryButtonText: { color: colors.textMuted, fontSize: fontSize.md, fontWeight: '600' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, width: '100%', gap: spacing.sm },
  modalTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: '800' },
  modalSub: { color: colors.textMuted, fontSize: fontSize.md, lineHeight: 22 },
  limits: { gap: spacing.sm, marginVertical: spacing.md },
  limitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  limitMark: { fontSize: fontSize.md, fontWeight: '900', width: 18 },
  limitText: { color: colors.text, fontSize: fontSize.md },
});
