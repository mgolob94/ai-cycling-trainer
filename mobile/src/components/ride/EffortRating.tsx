import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

import Text from '../ui/Text';
import { useMetricTooltip } from '../metrics/MetricTooltip';
import { spacing } from '../../theme/tokens';
import { useTheme, DARK_TOKENS } from '../../theme/useTheme';
import type { KnowledgeLevel } from '../../services/userLevel';

interface Tier {
  max: number;
  stars: number;
  label: string;
  context: string;
}

// Star rating + label + one-line guidance from TSS. The human-readable stand-in
// for a raw TSS number (per docs/prompts-data-clarity.md prompt 7).
const TIERS: Tier[] = [
  { max: 50, stars: 1, label: 'Light ride', context: 'Easy effort. Good for active recovery or building the habit.' },
  { max: 100, stars: 2, label: 'Moderate effort', context: 'Solid ride. Body will adapt from this.' },
  { max: 150, stars: 3, label: 'Solid workout', context: 'Demanding session. Eat well and sleep tonight.' },
  { max: 200, stars: 4, label: 'Hard day', context: 'Big effort. At least one easy day before going hard again.' },
  { max: Infinity, stars: 5, label: 'Maximum effort', context: 'You emptied the tank. Two recovery days minimum.' },
];

interface Props {
  tss: number;
  durationMin?: number;
  level: KnowledgeLevel;
  /** Render with light text for placement on a dark surface (e.g. RideDetail). */
  onDark?: boolean;
}

/**
 * Effort rating that adapts to the user's knowledge level:
 *   beginner     → stars + label + context (no raw TSS)
 *   intermediate → stars + label + "TSS: n · What's TSS? ⓘ"
 *   advanced     → TSS number primary, stars secondary
 */
export default function EffortRating({ tss, level, onDark = false }: Props) {
  const theme = useTheme();
  const colors = onDark ? DARK_TOKENS : theme.colors;
  const { show } = useMetricTooltip();

  const tier = TIERS.find((t) => tss <= t.max) ?? TIERS[TIERS.length - 1];
  const starColor = colors.green ?? colors.primary;

  const stars = (size: number) => (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= tier.stars ? 'star' : 'star-outline'} size={size} color={i <= tier.stars ? starColor : colors.surfaceRaised} />
      ))}
    </View>
  );

  if (level === 'advanced') {
    return (
      <View style={styles.advanced}>
        <View style={styles.advRow}>
          <Text variant="stat" color={colors.textPrimary} style={styles.advValue}>
            {Math.round(tss)}
          </Text>
          <Text variant="label" color={colors.textDim} style={styles.advUnit}>
            TSS
          </Text>
        </View>
        {stars(16)}
        <Text variant="caption" color={colors.textSecondary} style={styles.context}>
          {tier.label} · {tier.context}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      {stars(18)}
      <Text variant="statSm" color={colors.textPrimary} style={styles.label}>
        {tier.label}
      </Text>
      <Text variant="caption" color={colors.textSecondary} style={styles.context}>
        {tier.context}
      </Text>
      {level === 'intermediate' ? (
        <Pressable style={styles.tssRow} onPress={() => show('tss', tss)} hitSlop={8}>
          <Text variant="caption" color={colors.textDim}>
            {`TSS: ${Math.round(tss)} · What's TSS?`}
          </Text>
          <Feather name="info" size={12} color={colors.textDim} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing[1] },
  starsRow: { flexDirection: 'row', gap: 2 },
  label: { fontSize: 16, marginTop: spacing[1] },
  context: { lineHeight: 19 },
  tssRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[1] },
  advanced: { gap: spacing[1] },
  advRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  advValue: { fontSize: 40, lineHeight: 44 },
  advUnit: { marginBottom: spacing[2] },
});
