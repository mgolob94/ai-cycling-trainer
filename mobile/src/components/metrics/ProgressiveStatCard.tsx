import { useEffect, useRef, useState } from 'react';
import { View, Pressable, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';

import { Text, Card } from '../ui';
import MetricTooltip, { useMetricTooltip, type MetricKey, type TooltipContent } from './MetricTooltip';
import { useKnowledgeLevel } from '../../context/KnowledgeLevelContext';
import { palette, spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
  metric: MetricKey;
  value: number;
  unit: string;
  /** Plain-language interpretation (from metricsInterpreter). */
  interpretation: string;
  /** Context sentence, e.g. "Your average is 228W — today you were 6% above". */
  context: string;
  /** Richer content shown in the level-3 tooltip sheet. */
  tooltipContent?: TooltipContent;
}

const METRIC_LABEL: Record<string, string> = {
  np: 'NP',
  tsb: 'TSB',
  ctl: 'CTL',
  atl: 'ATL',
  ftp: 'FTP',
  vi: 'VI',
  ef: 'EF',
  tss: 'TSS',
  wprime: "W'",
};

const EXPANDED_KEY = 'progressiveStat.expanded';

// A gentle ~300ms spring for the expand/collapse height change.
const SPRING_LAYOUT = {
  duration: 280,
  update: { type: LayoutAnimation.Types.spring, springDamping: 0.85 },
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

async function readExpandedSet(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(EXPANDED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function rememberExpanded(metric: string): Promise<void> {
  const set = await readExpandedSet();
  if (!set.includes(metric)) {
    set.push(metric);
    await AsyncStorage.setItem(EXPANDED_KEY, JSON.stringify(set));
  }
}

/**
 * Progressive disclosure stat card with three levels:
 *   1 (beginner)     plain language only
 *   2 (intermediate) + the raw number(s) on expand
 *   3 (advanced)     ⓘ opens the full MetricTooltip sheet
 *
 * Advanced/intermediate users (and beginners who expanded this metric before)
 * start at level 2. Uses the built-in LayoutAnimation for the expand spring
 * (reanimated is intentionally not installed).
 */
export default function ProgressiveStatCard({ metric, value, unit, interpretation, context, tooltipContent }: Props) {
  const { colors } = useTheme();
  const { level, config, track } = useKnowledgeLevel();
  const { show } = useMetricTooltip();

  // Advanced/intermediate start expanded; beginners start collapsed unless they
  // expanded this metric before.
  const startExpanded = config.defaultExpanded || level !== 'beginner';
  const [expanded, setExpanded] = useState(startExpanded);
  const hydrated = useRef(false);

  useEffect(() => {
    if (hydrated.current || startExpanded) return;
    hydrated.current = true;
    readExpandedSet().then((set) => {
      if (set.includes(metric)) setExpanded(true);
    });
  }, [metric, startExpanded]);

  const expand = () => {
    LayoutAnimation.configureNext(SPRING_LAYOUT);
    setExpanded(true);
    track('show_more'); // level 1 → 2 (auto-upgrade trigger)
    rememberExpanded(metric).catch(() => {});
  };

  const collapse = () => {
    LayoutAnimation.configureNext(SPRING_LAYOUT);
    setExpanded(false);
  };

  // Level 2 → 3: open the tooltip sheet (which tracks 'tooltip' internally).
  const openTooltip = () => show(metric, value, tooltipContent);

  const numberVariant = config.numberSize === 'normal' ? 'statMd' : 'statSm';
  const label = METRIC_LABEL[metric] ?? metric.toUpperCase();

  return (
    <Card variant="raised">
      {/* Plain language (always shown) */}
      <Text variant="bodyLarge" color={colors.textPrimary} style={styles.interpretation}>
        {interpretation}
      </Text>
      <Text variant="caption" color={colors.textSecondary} style={styles.context}>
        {context}
      </Text>

      {expanded ? (
        <>
          <View style={[styles.divider, { backgroundColor: colors.borderSubtle }]} />
          <View style={styles.numberRow}>
            <Text variant={numberVariant} color={colors.textSecondary}>
              {label}: {value}
              {unit}
            </Text>
            <View style={styles.flex} />
            <Pressable onPress={openTooltip} hitSlop={10} accessibilityLabel="What is this?">
              <Feather name="info" size={16} color={palette.slate400} />
            </Pressable>
          </View>
          {/* Collapsing back is allowed at any level. */}
          <Pressable style={styles.toggle} onPress={collapse} hitSlop={6}>
            <Text variant="label" color={palette.slate400}>
              Hide
            </Text>
            <Feather name="chevron-up" size={16} color={palette.slate400} />
          </Pressable>
        </>
      ) : (
        <Pressable style={[styles.toggle, styles.toggleEnd]} onPress={expand} hitSlop={6}>
          <Text variant="label" color={colors.accent}>
            Show more
          </Text>
          <Feather name="chevron-down" size={16} color={colors.accent} />
        </Pressable>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  interpretation: { fontWeight: '600' },
  context: { marginTop: spacing[1], lineHeight: 19 },
  divider: { height: 1, marginVertical: spacing[3] },
  numberRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flex: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing[1], marginTop: spacing[3] },
  toggleEnd: { marginTop: spacing[2] },
});

// Re-export so call sites can import the tooltip trigger alongside the card.
export { MetricTooltip };
