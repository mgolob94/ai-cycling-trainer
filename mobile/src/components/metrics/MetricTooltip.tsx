import { createContext, useContext, useState, type ReactNode } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import Text from '../ui/Text';
import { spacing, radius, palette } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

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
    short: 'The difference between your fitness and your fatigue.',
    analogy: 'Like a battery: positive = charged, negative = drained.',
    inYourCase: (v) => `Your form is currently ${Math.round(v)} — ${v >= 5 ? 'fresh side' : v >= -10 ? 'balanced' : 'fatigued side'}.`,
  },
  ctl: {
    name: 'Fitness (CTL)',
    short: 'A 42-day average of your training load.',
    analogy: "How much 'fitness in the bank' you have. Builds slowly, fades slowly.",
    inYourCase: (v) => `Your fitness is ${Math.round(v)}.`,
  },
  atl: {
    name: 'Fatigue (ATL)',
    short: 'A 7-day average — how hard the last week has been.',
    analogy: 'How heavy your legs feel today.',
    inYourCase: (v) => `Your fatigue is ${Math.round(v)}.`,
  },
  ftp: {
    name: 'FTP — Functional Threshold Power',
    short: 'The max power you can hold for about an hour.',
    analogy: 'Your engine. A higher FTP means more speed for the same effort.',
    inYourCase: (v) => `Your FTP is ${Math.round(v)} W.`,
  },
  tss: {
    name: 'Training Stress (TSS)',
    short: 'Total load of a ride — time combined with intensity.',
    analogy: '60 min at FTP = 100 TSS. 2h easy = ~60 TSS.',
    inYourCase: (v) => `This effort was ${Math.round(v)} TSS.`,
  },
  np: {
    name: 'Normalized Power (NP)',
    short: "A ride's true physiological load.",
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

// ---------------------------------------------------------------------------
// Context + provider: one modal at the root, shown imperatively from anywhere.
// ---------------------------------------------------------------------------
interface TooltipState {
  metric: MetricKey;
  value?: number;
}
interface TooltipContextValue {
  show: (metric: MetricKey, value?: number) => void;
}

const TooltipContext = createContext<TooltipContextValue>({ show: () => {} });

export function MetricTooltipProvider({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<TooltipState | null>(null);

  const show = (metric: MetricKey, value?: number) => setState({ metric, value });
  const close = () => setState(null);

  const def = state ? METRICS[state.metric] : null;

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
            {def ? (
              <View style={styles.body}>
                <Text variant="heading3" color={colors.textPrimary}>
                  {def.name}
                </Text>
                <Text variant="body" color={colors.textSecondary} style={styles.line}>
                  {def.short}
                </Text>
                {state?.value != null && def.inYourCase ? (
                  <View style={[styles.callout, { backgroundColor: colors.surfaceRaised }]}>
                    <Text variant="label" color={colors.textTertiary}>
                      IN YOUR CASE
                    </Text>
                    <Text variant="body" color={colors.textPrimary} style={styles.line}>
                      {def.inYourCase(state.value)}
                    </Text>
                  </View>
                ) : null}
                <Text variant="caption" color={colors.textSecondary} style={styles.analogy}>
                  💡 {def.analogy}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </TooltipContext.Provider>
  );
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
});
