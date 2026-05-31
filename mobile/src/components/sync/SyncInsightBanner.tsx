import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Text } from '../ui';
import { spacing } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

interface Props {
  text: string;
  onDismiss: () => void;
}

/**
 * Temporary "what we learned from this ride" banner at the top of the Dashboard.
 * Slides down on mount, auto-dismisses after 8s. Not a notification.
 */
export default function SyncInsightBanner({ text, onDismiss }: Props) {
  const { colors } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    // Pulse the dot twice, then stop.
    Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0.4, duration: 400, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0.4, duration: 400, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(close, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const close = () => {
    Animated.timing(anim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(onDismiss);
  };

  const style = {
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
  };

  return (
    <Animated.View style={[styles.banner, { backgroundColor: colors.surface, borderBottomColor: colors.border }, style]}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary, opacity: dot }]} />
      <Text variant="caption" color={colors.textPrimary} style={styles.text}>
        {text}
      </Text>
      <Pressable onPress={close} hitSlop={10}>
        <Text variant="caption" color={colors.textTertiary}>
          ✕
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingHorizontal: spacing[5], paddingVertical: spacing[3], borderBottomWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { flex: 1, lineHeight: 19 },
});
