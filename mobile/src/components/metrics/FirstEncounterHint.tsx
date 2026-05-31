import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import Text from '../ui/Text';
import { METRIC_CONTEXT, type MetricContextKey } from '../../services/metricContext';
import { shouldShowFirstEncounter, markAsSeen } from '../../services/tooltipTrigger';
import { useKnowledgeLevel } from '../../context/KnowledgeLevelContext';
import { spacing, radius } from '../../theme/tokens';

// Only one hint may be visible app-wide at a time (never spam).
let hintActive = false;

interface Props {
  metric: MetricContextKey;
  value?: number;
}

/**
 * A subtle, one-time hint shown below a metric the first time the user sees it.
 * Not a modal/sheet — a small dark floating bubble that auto-dismisses after 4s.
 * Suppressed entirely for advanced users.
 */
export default function FirstEncounterHint({ metric }: Props) {
  const { level } = useKnowledgeLevel();
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const claimed = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let dismissTimer: ReturnType<typeof setTimeout>;

    (async () => {
      if (level === 'advanced') return;
      if (hintActive) return;
      if (!(await shouldShowFirstEncounter(metric))) return;
      if (cancelled) return;

      hintActive = true;
      claimed.current = true;
      await markAsSeen(metric);
      setVisible(true);
      Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      dismissTimer = setTimeout(dismiss, 4000);
    })();

    return () => {
      cancelled = true;
      clearTimeout(dismissTimer);
      if (claimed.current) hintActive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, level]);

  const dismiss = () => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => {
      setVisible(false);
      if (claimed.current) {
        hintActive = false;
        claimed.current = false;
      }
    });
  };

  if (!visible) return null;

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  };

  return (
    <Animated.View style={[styles.anchor, style]} pointerEvents="box-none">
      <View style={styles.triangle} />
      <Pressable style={styles.bubble} onPress={dismiss}>
        <Text variant="caption" color="#FFFFFF" style={styles.text}>
          {METRIC_CONTEXT[metric].short} Tap ⓘ to learn more.
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Floats below the metric without affecting layout (parent should be relative).
  anchor: { position: 'absolute', top: '100%', left: 0, marginTop: 4, zIndex: 50, alignItems: 'flex-start' },
  triangle: {
    width: 0,
    height: 0,
    marginLeft: spacing[3],
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#111110',
  },
  bubble: { maxWidth: 200, backgroundColor: '#111110', borderRadius: radius.sm, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  text: { lineHeight: 17 },
});
