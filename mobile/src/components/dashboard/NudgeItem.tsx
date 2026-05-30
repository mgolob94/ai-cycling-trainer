import { View, Pressable, StyleSheet } from 'react-native';

import { Text, Card } from '../ui';
import type { Nudge } from '../../services/nudgeService';
import { palette, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  nudge: Nudge;
  onAction?: (screen: string) => void;
  onDismiss?: (id: string) => void;
}

/** A single nudge rendered as a tinted card with icon, message, optional action + dismiss. */
export default function NudgeItem({ nudge, onAction, onDismiss }: Props) {
  const { colors } = useTheme();
  return (
    <Card variant="tinted" style={styles.card}>
      <Text style={styles.icon}>{nudge.icon}</Text>
      <View style={styles.body}>
        <Text variant="body" color={colors.textPrimary} style={styles.message}>
          {nudge.message}
        </Text>
        <Text variant="caption" color={colors.textSecondary} style={styles.detail}>
          {nudge.detail}
        </Text>
        {nudge.action ? (
          <Pressable onPress={() => onAction?.(nudge.action!.screen)} hitSlop={6} style={styles.action}>
            <Text variant="caption" color={palette.indigo600} style={styles.actionText}>
              {nudge.action.label} →
            </Text>
          </Pressable>
        ) : null}
      </View>
      {onDismiss ? (
        <Pressable onPress={() => onDismiss(nudge.id)} hitSlop={10}>
          <Text variant="caption" color={palette.slate400} style={styles.dismiss}>
            ✕
          </Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  icon: { fontSize: 22 },
  body: { flex: 1, gap: 2 },
  message: { fontWeight: '600' },
  detail: { lineHeight: 19 },
  action: { marginTop: spacing[2] },
  actionText: { fontWeight: '700' },
  dismiss: { fontWeight: '700', paddingLeft: spacing[2] },
});
