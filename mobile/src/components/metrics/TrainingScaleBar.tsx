import { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

import Text from '../ui/Text';
import { spacing, radius, palette } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export interface ScaleZone {
  from: number;
  to: number;
  label: string;
  color: string;
}

interface Props {
  value: number;
  min: number;
  max: number;
  zones: ScaleZone[];
  showValue?: boolean;
  /** Use light label colors for placement on a dark surface (e.g. the hero card). */
  onDark?: boolean;
}

/**
 * Shows where a value sits on a spectrum — context instead of a raw number.
 * The indicator slides to position on mount (built-in Animated spring, since
 * reanimated is intentionally not installed).
 */
export default function TrainingScaleBar({ value, min, max, zones, showValue = false, onDark = false }: Props) {
  const { colors } = useTheme();
  const mutedColor = onDark ? palette.slate400 : colors.textTertiary;
  const strongColor = onDark ? '#FFFFFF' : colors.textPrimary;
  const span = max - min || 1;
  const fraction = Math.max(0, Math.min(1, (value - min) / span));

  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!barWidth) return;
    Animated.spring(translateX, {
      toValue: fraction * barWidth,
      useNativeDriver: true,
      speed: 12,
      bounciness: 6,
    }).start();
  }, [fraction, barWidth, translateX]);

  const current = zones.find((z) => value >= z.from && value < z.to) ?? zones[zones.length - 1];

  return (
    <View>
      <View
        style={styles.track}
        onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
      >
        {zones.map((z, i) => (
          <View
            key={i}
            style={{ flex: Math.max(0, z.to - z.from), backgroundColor: z.color }}
          />
        ))}
        {barWidth > 0 ? (
          <Animated.View
            style={[
              styles.indicator,
              { borderColor: colors.surface, transform: [{ translateX }] },
            ]}
          />
        ) : null}
      </View>

      <View style={styles.labels}>
        <Text variant="caption" color={mutedColor}>
          {zones[0]?.label}
        </Text>
        <Text variant="label" color={strongColor} style={styles.currentLabel}>
          {current?.label}
          {showValue ? ` · ${Math.round(value)}` : ''}
        </Text>
        <Text variant="caption" color={mutedColor}>
          {zones[zones.length - 1]?.label}
        </Text>
      </View>
    </View>
  );
}

const INDICATOR = 14;

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    height: 6,
    borderRadius: radius.full,
    overflow: 'visible',
    marginVertical: INDICATOR / 2,
  },
  indicator: {
    position: 'absolute',
    top: 6 / 2 - INDICATOR / 2,
    left: -INDICATOR / 2,
    width: INDICATOR,
    height: INDICATOR,
    borderRadius: INDICATOR / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#0D0D0C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  labels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing[1],
  },
  currentLabel: { textTransform: 'none', letterSpacing: 0, fontWeight: '700' },
});
