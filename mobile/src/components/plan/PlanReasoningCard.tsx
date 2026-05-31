import { useState } from 'react';
import { View, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { Text } from '../ui';
import type { PlanReasoning } from '../../hooks/useTrainingPlan';
import { spacing, radius } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  reasoning: PlanReasoning;
  generatedAt?: string;
  onRefresh?: () => void;
}

/**
 * "Why this week" — the coach's reasoning for the plan, shown above the workout
 * list. Answers WHY before the user sees WHAT. Dark card.
 */
export default function PlanReasoningCard({ reasoning, generatedAt, onRefresh }: Props) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const bullets = reasoning.bullets ?? [];
  const key = reasoning.key_workout;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceDark }]}>
      <View style={styles.topRow}>
        <Text variant="label" color={colors.green}>
          WHY THIS WEEK
        </Text>
        <View style={styles.topRight}>
          {generatedAt ? (
            <Text variant="caption" color="#525250" style={styles.ts}>
              {generatedAt.slice(0, 10)}
            </Text>
          ) : null}
          {onRefresh ? (
            <Pressable onPress={onRefresh} hitSlop={10} accessibilityLabel="Regenerate reasoning">
              <Feather name="refresh-cw" size={13} color="#525250" />
            </Pressable>
          ) : null}
        </View>
      </View>

      {reasoning.headline ? (
        <Text variant="heading3" color="#FFFFFF" style={styles.headline}>
          {reasoning.headline}
        </Text>
      ) : null}

      {bullets.length ? (
        <View style={styles.bullets}>
          {bullets.map((b, i) => {
            const text = b.replace(/^→\s*/, '');
            return (
              <View key={i} style={styles.bulletRow}>
                <Text variant="body" color={colors.green} style={styles.arrow}>
                  →
                </Text>
                <Text variant="caption" color="#787876" style={styles.bulletText}>
                  {text}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {key?.why ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text variant="label" color={colors.green}>
            KEY SESSION THIS WEEK
          </Text>
          <Text variant="caption" color="rgba(255,255,255,0.8)" style={styles.keyText}>
            {key.day ? `${key.day} — ` : ''}
            {key.why}
          </Text>
        </>
      ) : null}

      {reasoning.what_to_expect ? (
        <Pressable onPress={toggle} hitSlop={6} style={styles.expandRow}>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#525250" />
          <Text variant="caption" color="#525250">
            What to expect this week
          </Text>
        </Pressable>
      ) : null}
      {expanded && reasoning.what_to_expect ? (
        <Text variant="caption" color="#787876" style={styles.expect}>
          {reasoning.what_to_expect}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, padding: spacing[5], gap: spacing[2] },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  ts: {},
  headline: { marginTop: spacing[1] },
  bullets: { gap: 6, marginTop: spacing[1] },
  bulletRow: { flexDirection: 'row', gap: spacing[2] },
  arrow: { fontWeight: '700', lineHeight: 22 },
  bulletText: { flex: 1, lineHeight: 22 },
  divider: { height: 1, marginVertical: spacing[3] },
  keyText: { lineHeight: 21, marginTop: 2 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[3] },
  expect: { fontStyle: 'italic', lineHeight: 21, marginTop: spacing[1] },
});
