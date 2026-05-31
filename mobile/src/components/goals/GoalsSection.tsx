import { useState } from 'react';
import { View, StyleSheet, Modal, Pressable, TextInput, ScrollView } from 'react-native';

import { useGoals, type Goal, type GoalInsight, type GoalType, type NewGoal } from '../../hooks/useGoals';
import { Text, Card, Button, Badge, SectionHeader, Emoji } from '../ui';
import { palette, spacing, radius } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

const TYPE_LABELS: Record<GoalType, string> = {
  ftp_target: 'FTP target',
  event: 'Event',
  consistency: 'Consistency',
  distance: 'Distance',
  fitness: 'Fitness (CTL)',
};

const TYPE_ORDER: GoalType[] = ['ftp_target', 'event', 'distance', 'consistency', 'fitness'];

function ProgressBar({ pct }: { pct: number }) {
  const { colors } = useThemeColors();
  const value = Math.max(0, Math.min(100, pct));
  const fill = value >= 75 ? colors.success : value >= 40 ? colors.warning : colors.accent;
  return (
    <View style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
      <View style={[styles.barFill, { width: `${value}%`, backgroundColor: fill }]} />
    </View>
  );
}

function GoalCard({ goal, fetchInsight }: { goal: Goal; fetchInsight: (id: string) => Promise<GoalInsight | null> }) {
  const { colors } = useThemeColors();
  const [insight, setInsight] = useState<GoalInsight | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);

  const loadInsight = async () => {
    setLoadingInsight(true);
    setInsight(await fetchInsight(goal.id));
    setLoadingInsight(false);
  };

  const onTrack = goal.current_progress >= 50;
  return (
    <Card variant="default" style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View style={styles.flex}>
          <Text variant="caption" color={colors.textTertiary}>
            {TYPE_LABELS[goal.goal_type]}
          </Text>
          <Text variant="bodyLarge">{goal.title || TYPE_LABELS[goal.goal_type]}</Text>
        </View>
        <Badge label={onTrack ? 'On track' : 'Heads up'} color={onTrack ? 'emerald' : 'amber'} />
      </View>

      <View style={styles.progressRow}>
        <ProgressBar pct={goal.current_progress} />
        <Text variant="statSm" style={styles.pct}>
          {Math.round(goal.current_progress)}%
        </Text>
      </View>

      {insight ? (
        <View style={styles.insight}>
          <Text variant="caption" color={colors.textSecondary}>
            <Emoji>{insight.on_track ? '🟢' : '🟡'}</Emoji> {insight.message}
          </Text>
          {insight.critical_action ? (
            <Text variant="caption" color={colors.textTertiary} style={styles.critical}>
              Focus: {insight.critical_action}
            </Text>
          ) : null}
        </View>
      ) : (
        <Button
          label={loadingInsight ? 'Thinking…' : 'Ask coach how I’m doing'}
          variant="ghost"
          size="sm"
          loading={loadingInsight}
          onPress={loadInsight}
        />
      )}
    </Card>
  );
}

function AddGoalModal({ visible, onClose, onCreate }: { visible: boolean; onClose: () => void; onCreate: (g: NewGoal) => Promise<void> }) {
  const { colors, isDark } = useThemeColors();
  const [type, setType] = useState<GoalType>('ftp_target');
  const [title, setTitle] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [targetFtp, setTargetFtp] = useState('');
  const [targetDistance, setTargetDistance] = useState('');
  const [eventName, setEventName] = useState('');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType('ftp_target');
    setTitle('');
    setTargetDate('');
    setTargetFtp('');
    setTargetDistance('');
    setEventName('');
  };

  const submit = async () => {
    setSaving(true);
    const goal: NewGoal = {
      goal_type: type,
      title: title.trim() || undefined,
      target_date: targetDate.trim() || null,
      target_ftp: type === 'ftp_target' || type === 'fitness' ? Number(targetFtp) || null : null,
      target_distance_km: type === 'distance' ? Number(targetDistance) || null : null,
      target_event_name: type === 'event' ? eventName.trim() || null : null,
    };
    try {
      await onCreate(goal);
      reset();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [styles.input, { color: colors.textPrimary, backgroundColor: colors.surfaceRaised }];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <ScrollView contentContainerStyle={styles.sheetContent}>
            <Text variant="bodyLarge" style={styles.sheetTitle}>
              New goal
            </Text>

            <Text variant="caption" color={colors.textSecondary}>
              Goal type
            </Text>
            <View style={styles.typeRow}>
              {TYPE_ORDER.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, { borderColor: type === t ? colors.accent : colors.border, backgroundColor: type === t ? (isDark ? 'rgba(129,140,248,0.18)' : palette.indigo50) : 'transparent' }]}
                  onPress={() => setType(t)}
                >
                  <Text variant="caption" color={type === t ? colors.accent : colors.textSecondary}>
                    {TYPE_LABELS[t]}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput style={inputStyle} placeholder="Title (e.g. Reach 300W FTP)" placeholderTextColor={colors.textTertiary} value={title} onChangeText={setTitle} />

            {type === 'ftp_target' || type === 'fitness' ? (
              <TextInput style={inputStyle} placeholder={type === 'fitness' ? 'Target CTL' : 'Target FTP (watts)'} placeholderTextColor={colors.textTertiary} keyboardType="number-pad" value={targetFtp} onChangeText={setTargetFtp} />
            ) : null}
            {type === 'distance' ? (
              <TextInput style={inputStyle} placeholder="Target distance (km)" placeholderTextColor={colors.textTertiary} keyboardType="number-pad" value={targetDistance} onChangeText={setTargetDistance} />
            ) : null}
            {type === 'event' ? (
              <TextInput style={inputStyle} placeholder="Event name" placeholderTextColor={colors.textTertiary} value={eventName} onChangeText={setEventName} />
            ) : null}

            <TextInput style={inputStyle} placeholder="Target date (YYYY-MM-DD)" placeholderTextColor={colors.textTertiary} value={targetDate} onChangeText={setTargetDate} />

            <View style={styles.sheetActions}>
              <Button label="Cancel" variant="ghost" size="md" onPress={onClose} />
              <Button label="Create goal" variant="primary" size="md" loading={saving} onPress={submit} />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function GoalsSection() {
  const { colors } = useThemeColors();
  const { goals, loading, createGoal, fetchInsight } = useGoals();
  const [adding, setAdding] = useState(false);

  const active = goals.filter((g) => g.status === 'active');
  if (loading) return null;

  return (
    <Card variant="default">
      <View style={styles.headerRow}>
        <SectionHeader title="GOALS" />
        <Button label="Add goal" variant="ghost" size="sm" onPress={() => setAdding(true)} />
      </View>

      {active.length === 0 ? (
        <Text variant="caption" color={colors.textSecondary} style={styles.empty}>
          No active goals yet. Set one and your coach will track your progress toward it.
        </Text>
      ) : (
        active.map((g) => <GoalCard key={g.id} goal={g} fetchInsight={fetchInsight} />)
      )}

      <AddGoalModal visible={adding} onClose={() => setAdding(false)} onCreate={createGoal} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  empty: { marginTop: spacing[2] },
  goalCard: { marginTop: spacing[3] },
  goalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3] },
  barTrack: { flex: 1, height: 8, borderRadius: radius.full, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: radius.full },
  pct: { minWidth: 44, textAlign: 'right' },
  insight: { marginTop: spacing[3], gap: spacing[1] },
  critical: { fontStyle: 'italic' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '85%' },
  sheetContent: { padding: spacing[5], gap: spacing[3] },
  sheetTitle: { marginBottom: spacing[1] },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  typeChip: { borderWidth: 1, borderRadius: radius.full, paddingHorizontal: spacing[3], paddingVertical: 6 },
  input: { borderRadius: radius.md, paddingHorizontal: spacing[4], paddingVertical: 12, fontSize: 15 },
  sheetActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing[2], marginTop: spacing[2] },
});
