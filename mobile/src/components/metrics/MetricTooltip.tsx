import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../ui/Text';
import { spacing, radius, palette, zoneColors } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { useKnowledgeLevel } from '../../context/KnowledgeLevelContext';
import { METRIC_CONTEXT, getRange, type MetricContextKey, type MetricContextDef, type MetricRange } from '../../services/metricContext';

export type MetricKey = 'tsb' | 'ctl' | 'atl' | 'ftp' | 'tss' | 'np' | 'vi' | 'ef' | 'wprime';

interface MetricDef {
  name: string;
  short: string;
  analogy: string;
  /** Personalized line given the user's current value. */
  inYourCase?: (value: number) => string;
}

// English definitions (plain language + an analogy).
const METRICS: Record<MetricKey, MetricDef> = {
  tsb: {
    name: 'Form (TSB)',
    short: 'Fitness minus fatigue. Positive = fresh. Negative = tired. Sweet spot is +5 to +15.',
    analogy: 'Like a battery: positive = charged, negative = drained.',
    inYourCase: (v) => `Your form is currently ${Math.round(v)} — ${v >= 5 ? 'fresh side' : v >= -10 ? 'balanced' : 'fatigued side'}.`,
  },
  ctl: {
    name: 'Fitness (CTL)',
    short: 'How fit you are right now. Builds slowly over months. Drops slowly too.',
    analogy: "How much 'fitness in the bank' you have. Builds slowly, fades slowly.",
    inYourCase: (v) => `Your fitness is ${Math.round(v)}.`,
  },
  atl: {
    name: 'Fatigue (ATL)',
    short: 'How tired your legs are. Spikes after hard weeks. Recovers in days.',
    analogy: 'How heavy your legs feel today.',
    inYourCase: (v) => `Your fatigue is ${Math.round(v)}.`,
  },
  ftp: {
    name: 'FTP — Functional Threshold Power',
    short: 'The maximum power you can hold for an hour. Your engine size. Higher = faster.',
    analogy: 'Your engine. A higher FTP means more speed for the same effort.',
    inYourCase: (v) => `Your FTP is ${Math.round(v)} W.`,
  },
  tss: {
    name: 'Training Stress (TSS)',
    short: 'How hard a ride was overall — combines time and intensity. 100 TSS = one hour at your limit.',
    analogy: '60 min at FTP = 100 TSS. 2h easy = ~60 TSS.',
    inYourCase: (v) => `This effort was ${Math.round(v)} TSS.`,
  },
  np: {
    name: 'Normalized Power (NP)',
    short: 'A smarter measure of effort than average power. Accounts for surges and climbs.',
    analogy: 'More realistic than average power — it accounts for intervals and climbs.',
    inYourCase: (v) => `NP was ${Math.round(v)} W.`,
  },
  vi: {
    name: 'Variability Index (VI)',
    short: 'How steady your power was.',
    analogy: '1.00 = perfectly steady. > 1.05 = very variable. Lower = better pacing.',
    inYourCase: (v) => `Your VI was ${v.toFixed(2)}.`,
  },
  ef: {
    name: 'Efficiency Factor (EF)',
    short: 'Power produced per heartbeat — an aerobic-fitness signal.',
    analogy: 'Rising EF over time means your aerobic engine is improving.',
    inYourCase: (v) => `Your EF was ${v.toFixed(2)}.`,
  },
  wprime: {
    name: "W' — Anaerobic capacity",
    short: "Your 'battery' for efforts above FTP.",
    analogy: 'Above FTP you spend W\'. Below FTP it refills. Empty = end of the sprint.',
    inYourCase: (v) => `Your W' is ${(v / 1000).toFixed(1)} kJ.`,
  },
};

// Optional richer level-3 content (personalized benchmark + historical compare).
export interface TooltipContent {
  benchmark?: string;
  historical?: string;
}

// ---------------------------------------------------------------------------
// Context + provider: one modal at the root, shown imperatively from anywhere.
// ---------------------------------------------------------------------------
interface TooltipState {
  metric: MetricKey;
  value?: number;
  extra?: TooltipContent;
}
interface TooltipContextValue {
  show: (metric: MetricKey, value?: number, extra?: TooltipContent) => void;
}

const TooltipContext = createContext<TooltipContextValue>({ show: () => {} });

export function MetricTooltipProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { track } = useKnowledgeLevel();
  const [state, setState] = useState<TooltipState | null>(null);

  const show = (metric: MetricKey, value?: number, extra?: TooltipContent) => {
    track('tooltip'); // 10+ tooltip opens auto-upgrades to advanced
    setState({ metric, value, extra });
  };
  const close = () => setState(null);

  // Prefer the rich METRIC_CONTEXT (ranges + analogy); fall back to the local
  // defs for metrics it doesn't cover (ef, wprime).
  const ctx: MetricContextDef | null = state ? (METRIC_CONTEXT as Record<string, MetricContextDef>)[state.metric] ?? null : null;
  const local = state ? METRICS[state.metric] : null;
  const name = ctx?.name ?? local?.name ?? '';
  const short = ctx?.short ?? local?.short ?? '';
  const analogy = ctx?.analogy ?? local?.analogy ?? '';
  const ranges = ctx?.ranges;
  const note = ctx?.weeklyGrowthNote ?? ctx?.raceTarget;
  const current = state?.value != null && ctx ? getRange(state.metric as MetricContextKey, state.value) : null;
  const spans = ranges ? buildSpans(ranges) : [];

  return (
    <TooltipContext.Provider value={{ show }}>
      {children}
      <Modal visible={!!state} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: (insets.bottom || 12) + spacing[4] }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            {state ? (
              <View style={styles.body}>
                <Text variant="heading3" color={colors.textPrimary}>
                  {name}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={styles.line}>
                  {short}
                </Text>

                {/* Analogy — the most important explainer */}
                <View style={[styles.analogyCard, { backgroundColor: colors.surfaceRaised }]}>
                  <Text variant="body" color={colors.textPrimary} style={styles.line}>
                    💡 {analogy}
                  </Text>
                </View>

                {/* Current value + its range label */}
                {state.value != null && current ? (
                  <View style={styles.currentBlock}>
                    <Text variant="label" color={colors.textTertiary}>
                      YOUR CURRENT VALUE
                    </Text>
                    <View style={styles.currentRow}>
                      <Text variant="statSm" color={colors.textPrimary}>
                        {formatValue(state.metric, state.value)}
                      </Text>
                      <View style={[styles.chip, { backgroundColor: `${resolveColor(current.color, colors)}22` }]}>
                        <Text variant="label" color={resolveColor(current.color, colors)}>
                          {current.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                ) : state.value != null && local?.inYourCase ? (
                  <View style={[styles.callout, { backgroundColor: colors.surfaceRaised }]}>
                    <Text variant="label" color={colors.textTertiary}>
                      IN YOUR CASE
                    </Text>
                    <Text variant="body" color={colors.textPrimary} style={styles.line}>
                      {local.inYourCase(state.value)}
                    </Text>
                  </View>
                ) : null}

                {/* Reference range table */}
                {ranges ? (
                  <View style={styles.rangeTable}>
                    <Text variant="label" color={colors.textTertiary}>
                      REFERENCE RANGES
                    </Text>
                    {ranges.map((r, i) => {
                      const active = current?.label === r.label;
                      return (
                        <View key={r.label} style={styles.rangeRow}>
                          <Text
                            variant="body"
                            color={active ? colors.textPrimary : colors.textSecondary}
                            style={active ? styles.activeRow : undefined}
                          >
                            {active ? '▶' : '●'} {r.label}
                          </Text>
                          <Text variant="caption" color={colors.textTertiary}>
                            {spans[i]}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ) : null}

                {note ? (
                  <Text variant="caption" color={colors.textTertiary} style={styles.note}>
                    {note}
                  </Text>
                ) : null}

                <Pressable style={[styles.gotIt, { borderColor: colors.border }]} onPress={close}>
                  <Text variant="body" color={colors.textPrimary} style={styles.gotItText}>
                    Got it
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </TooltipContext.Provider>
  );
}

/** Range `color` token → concrete color (zone key or status key). */
function resolveColor(token: string | undefined, colors: ReturnType<typeof useTheme>['colors']): string {
  if (!token) return colors.textSecondary;
  if (token in zoneColors) return zoneColors[token as keyof typeof zoneColors];
  if (token === 'green') return colors.green ?? colors.primary;
  if (token === 'warning') return colors.warning;
  if (token === 'danger') return colors.danger;
  return colors.textSecondary;
}

/** Human numeric span for each range row, e.g. "40–60", "0–20", "200+". */
function buildSpans(ranges: MetricRange[]): string[] {
  let prevMax = ranges[0]?.min ?? 0;
  return ranges.map((r) => {
    const lo = r.min ?? prevMax;
    const hi = r.max ?? 999;
    prevMax = hi;
    if (lo <= -900) return `< ${hi}`;
    if (hi >= 900) return `${lo}+`;
    return `${lo}–${hi}`;
  });
}

function formatValue(metric: MetricKey, value: number): string {
  if (metric === 'tsb') return `${value >= 0 ? '+' : ''}${Math.round(value)}`;
  if (metric === 'vi') return value.toFixed(2);
  return `${Math.round(value)}`;
}

/** Imperative tooltip API — callable from anywhere under the provider. */
export function useMetricTooltip(): TooltipContextValue {
  return useContext(TooltipContext);
}

// ---------------------------------------------------------------------------
// Trigger: small ⓘ icon next to a metric label.
// ---------------------------------------------------------------------------
interface TriggerProps {
  metric: MetricKey;
  value?: number;
  triggerSize?: 'sm' | 'md';
}

export default function MetricTooltip({ metric, value, triggerSize = 'sm' }: TriggerProps) {
  const { show } = useMetricTooltip();
  const size = triggerSize === 'md' ? 16 : 12;
  return (
    <Pressable onPress={() => show(metric, value)} hitSlop={10} accessibilityLabel="What is this?">
      <Feather name="info" size={size} color={palette.slate400} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(13,13,12,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[5],
    paddingTop: spacing[3],
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: radius.full, marginBottom: spacing[4] },
  body: { gap: spacing[3] },
  line: { lineHeight: 22 },
  callout: { borderRadius: radius.md, padding: spacing[4], gap: spacing[1] },
  analogy: { lineHeight: 20 },
  analogyCard: { borderRadius: radius.md, padding: spacing[4] },
  currentBlock: { gap: spacing[1] },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.xs },
  rangeTable: { gap: spacing[2] },
  rangeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activeRow: { fontWeight: '700' },
  note: { fontStyle: 'italic', lineHeight: 18 },
  gotIt: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center', marginTop: spacing[2] },
  gotItText: { fontWeight: '700' },
});
