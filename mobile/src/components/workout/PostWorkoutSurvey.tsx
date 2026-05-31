import { useEffect, useRef, useState } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { api } from '../../services/api';
import { markSurveyAnswered, markSurveyDismissed } from '../../services/surveyTrigger';
import { Text, Emoji } from '../ui';
import { palette, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  userId?: string;
  stravaActivityId?: string;
  rideTitle?: string;
  distanceKm?: number | null;
  workoutDate?: string; // YYYY-MM-DD
  plannedTss?: number | null;
  actualTss?: number | null;
  /** Called once the survey is submitted, dismissed, or auto-closed. */
  onDone: () => void;
}

type Completion = 'completed' | 'partial' | 'skipped';

// Q1 — wording from docs/ui-copy.md. Two map to 'partial'; only "Skipped" ends early.
const COMPLETION: { value: Completion; icon: keyof typeof Feather.glyphMap; label: string; end?: boolean }[] = [
  { value: 'completed', icon: 'check', label: 'Nailed it' },
  { value: 'partial', icon: 'minus', label: 'Mostly done' },
  { value: 'partial', icon: 'corner-left-down', label: 'Cut it short' },
  { value: 'skipped', icon: 'circle', label: 'Skipped', end: true },
];

// Q2 — perceived effort 1–4.
const EFFORT = [
  { value: 1, emoji: '😴', label: 'Too easy' },
  { value: 2, emoji: '😊', label: 'About right' },
  { value: 3, emoji: '😤', label: 'Hard' },
  { value: 4, emoji: '💀', label: 'Too much' },
];

// Q3 — feeling now 1–3.
const FEELING = [
  { value: 1, emoji: '😊', label: 'Fresh' },
  { value: 2, emoji: '😐', label: 'Normal' },
  { value: 3, emoji: '😫', label: 'Tired' },
];

/**
 * Quick (<20s) post-workout survey — shown after a ride syncs. Max 3 questions.
 * Submits to POST /rides/:id/feedback (the coach's learning loop) and auto-closes.
 */
export default function PostWorkoutSurvey({
  visible,
  userId,
  stravaActivityId,
  rideTitle,
  distanceKm,
  workoutDate,
  plannedTss,
  actualTss,
  onDone,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<number | null>(null); // index into COMPLETION
  const [effort, setEffort] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const submittedRef = useRef(false);

  const reset = () => {
    setSelected(null);
    setEffort(null);
    setFeeling(null);
    setSuccess(false);
    submittedRef.current = false;
  };

  const close = () => {
    reset();
    onDone();
  };

  const submit = async (status: Completion) => {
    if (submittedRef.current || !stravaActivityId) {
      close();
      return;
    }
    submittedRef.current = true;
    setSuccess(true);
    if (userId) markSurveyAnswered(userId, stravaActivityId).catch(() => {});
    try {
      await api.post(`/rides/${stravaActivityId}/feedback`, {
        workout_date: workoutDate,
        completion_status: status,
        perceived_effort: status === 'skipped' ? null : effort,
        post_feeling: status === 'skipped' ? null : feeling,
        planned_tss: plannedTss ?? null,
        actual_tss: actualTss ?? null,
      });
    } catch {
      /* best-effort — the survey is already marked answered locally */
    }
    // Brief success state, then dismiss.
    setTimeout(close, 500);
  };

  // Swipe down / tap outside before completing → save the partial answer.
  const dismiss = () => {
    if (success) return;
    if (userId && stravaActivityId) markSurveyDismissed(userId, stravaActivityId).catch(() => {});
    const sel = selected != null ? COMPLETION[selected] : null;
    if (sel && !submittedRef.current) {
      submit(sel.value); // persist whatever was answered
    } else {
      close();
    }
  };

  const completion = selected != null ? COMPLETION[selected] : null;
  const showRest = completion != null && !completion.end;

  // Auto-submit 800ms after the final question is answered.
  useEffect(() => {
    if (showRest && effort != null && feeling != null && !submittedRef.current) {
      const t = setTimeout(() => submit(completion!.value), 800);
      return () => clearTimeout(t);
    }
  }, [showRest, effort, feeling]); // eslint-disable-line react-hooks/exhaustive-deps

  const header = [rideTitle || 'Your ride', distanceKm != null ? `${Math.round(distanceKm)} km` : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || 12) + spacing[4] }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {success ? (
            <View style={styles.successBox}>
              <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
                <Feather name="check" size={26} color="#FFFFFF" />
              </View>
              <Text variant="heading3" color={colors.textPrimary}>
                Got it.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text variant="heading3" color={colors.textPrimary} style={styles.headerTitle}>
                  {header}
                </Text>
                <Pressable onPress={dismiss} hitSlop={12} accessibilityLabel="Dismiss">
                  <Feather name="x" size={20} color={colors.textSecondary} />
                </Pressable>
              </View>

              {/* Q1 — completion */}
              <Text variant="body" color={colors.textPrimary} style={styles.q}>
                How did the workout go?
              </Text>
              <View style={styles.stack}>
                {COMPLETION.map((c, i) => {
                  const active = selected === i;
                  return (
                    <Pressable
                      key={c.label}
                      style={[
                        styles.option,
                        { backgroundColor: active ? colors.surfaceRaised : 'transparent', borderColor: colors.border },
                        active && { borderLeftColor: colors.textPrimary, borderLeftWidth: 3 },
                      ]}
                      onPress={() => {
                        setSelected(i);
                        if (c.end) submit(c.value); // "Skipped" → straight to submit
                      }}
                    >
                      <Feather name={c.icon} size={16} color={colors.textPrimary} />
                      <Text variant="body" color={colors.textPrimary} style={styles.optionLabel}>
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {showRest ? (
                <>
                  {/* Q2 — effort */}
                  <Text variant="body" color={colors.textPrimary} style={styles.q}>
                    How hard was it?
                  </Text>
                  <View style={styles.row}>
                    {EFFORT.map((e) => (
                      <Pressable key={e.value} style={styles.faceCol} onPress={() => setEffort(e.value)}>
                        <View
                          style={[
                            styles.faceCircle,
                            effort === e.value && { backgroundColor: colors.surfaceRaised, borderColor: palette.emerald400, transform: [{ scale: 1.1 }] },
                          ]}
                        >
                          <Emoji size={28}>{e.emoji}</Emoji>
                        </View>
                        <Text variant="caption" color={colors.textSecondary} style={styles.faceLabel}>
                          {e.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Q3 — feeling */}
                  <Text variant="body" color={colors.textPrimary} style={styles.q}>
                    How do you feel now?
                  </Text>
                  <View style={styles.row}>
                    {FEELING.map((f) => (
                      <Pressable key={f.value} style={styles.faceCol} onPress={() => setFeeling(f.value)}>
                        <View
                          style={[
                            styles.faceCircle,
                            feeling === f.value && { backgroundColor: colors.surfaceRaised, borderColor: palette.emerald400, transform: [{ scale: 1.1 }] },
                          ]}
                        >
                          <Emoji size={28}>{f.emoji}</Emoji>
                        </View>
                        <Text variant="caption" color={colors.textSecondary} style={styles.faceLabel}>
                          {f.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,13,12,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[3] },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, marginBottom: spacing[2] },

  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[3] },
  headerTitle: { flex: 1 },

  q: { fontWeight: '600', marginTop: spacing[2] },
  stack: { gap: spacing[2] },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], height: 48, paddingHorizontal: spacing[3], borderWidth: 1, borderRadius: radius.md },
  optionLabel: { fontWeight: '500' },

  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing[2] },
  faceCol: { alignItems: 'center', flex: 1, gap: spacing[1] },
  faceCircle: { width: 52, height: 52, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  faceLabel: { textAlign: 'center' },

  successBox: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[6] },
  successCircle: { width: 56, height: 56, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
});
