import { useState } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api } from '../../services/api';
import { Text, Emoji } from '../ui';
import { palette, spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  visible: boolean;
  stravaActivityId?: string;
  workoutDate?: string; // YYYY-MM-DD
  plannedTss?: number;
  actualTss?: number;
  onDone: () => void;
}

type Completion = 'completed' | 'partial' | 'skipped';

const COMPLETION: { value: Completion; mark: string; label: string }[] = [
  { value: 'completed', mark: '✓', label: 'Did it all' },
  { value: 'partial', mark: '~', label: 'Partly' },
  { value: 'skipped', mark: '✕', label: "Didn't ride" },
];

const EFFORT = [
  { emoji: '😴', label: 'Too easy' },
  { emoji: '😊', label: 'Easy' },
  { emoji: '😐', label: 'Just right' },
  { emoji: '😤', label: 'Hard' },
  { emoji: '💀', label: 'Too much' },
];

const FEELING = [
  { value: 1, label: 'Fresh' },
  { value: 2, label: 'Normal' },
  { value: 3, label: 'Tired' },
];

/**
 * Quick (<30s) post-workout survey — shown ~30 min after a ride syncs. Max 3
 * questions. Submits to POST /workouts/feedback (the coach's learning loop).
 */
export default function PostWorkoutSurvey({ visible, stravaActivityId, workoutDate, plannedTss, actualTss, onDone }: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [completion, setCompletion] = useState<Completion | null>(null);
  const [effort, setEffort] = useState<number | null>(null);
  const [feeling, setFeeling] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setCompletion(null);
    setEffort(null);
    setFeeling(null);
  };

  const submit = async (status: Completion) => {
    setSubmitting(true);
    try {
      await api.post('/workouts/feedback', {
        workout_date: workoutDate,
        strava_activity_id: stravaActivityId,
        completion_status: status,
        perceived_effort: status === 'completed' ? (effort != null ? effort + 1 : null) : null,
        post_feeling: status === 'completed' ? feeling : null,
        planned_tss: plannedTss ?? null,
        actual_tss: actualTss ?? null,
      });
    } catch {
      /* best-effort */
    } finally {
      setSubmitting(false);
      reset();
      onDone();
    }
  };

  const canFinish = completion === 'completed' && effort != null && feeling != null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || 12) + spacing[4] }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Text variant="heading3" color={colors.textPrimary}>
            How did the workout go?
          </Text>
          <View style={styles.row}>
            {COMPLETION.map((c) => {
              const active = completion === c.value;
              return (
                <Pressable
                  key={c.value}
                  style={[styles.chip, active && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
                  onPress={() => {
                    setCompletion(c.value);
                    if (c.value !== 'completed') submit(c.value); // skipped/partial → done
                  }}
                >
                  <Text variant="caption" color={active ? colors.background : colors.textPrimary} style={styles.bold}>
                    {c.mark} {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {completion === 'completed' ? (
            <>
              <Text variant="body" color={colors.textPrimary} style={styles.q}>
                How hard was it?
              </Text>
              <View style={styles.row}>
                {EFFORT.map((e, i) => (
                  <Pressable key={e.label} style={styles.effort} onPress={() => setEffort(i)}>
                    <View style={[styles.effortCircle, effort === i && { backgroundColor: colors.surfaceRaised, borderColor: palette.emerald400 }]}>
                      <Emoji size={22}>{e.emoji}</Emoji>
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text variant="body" color={colors.textPrimary} style={styles.q}>
                How do you feel now?
              </Text>
              <View style={styles.row}>
                {FEELING.map((f) => {
                  const active = feeling === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      style={[styles.chip, active && { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }]}
                      onPress={() => setFeeling(f.value)}
                    >
                      <Text variant="caption" color={active ? colors.background : colors.textPrimary} style={styles.bold}>
                        {f.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={[styles.submit, { backgroundColor: canFinish ? colors.primary : colors.border }]}
                disabled={!canFinish || submitting}
                onPress={() => submit('completed')}
              >
                <Text variant="body" color="#FFFFFF" style={styles.bold}>
                  Done
                </Text>
              </Pressable>
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,13,12,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing[5], paddingTop: spacing[3], gap: spacing[3] },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, marginBottom: spacing[2] },
  row: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  q: { fontWeight: '600', marginTop: spacing[2] },
  chip: { borderWidth: 1, borderColor: palette.slate200, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 8 },
  bold: { fontWeight: '700' },
  effort: { alignItems: 'center', flex: 1 },
  effortCircle: { width: 48, height: 48, borderRadius: radius.full, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  submit: { borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing[3] },
});
