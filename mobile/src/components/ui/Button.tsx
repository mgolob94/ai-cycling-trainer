import type { ReactNode } from 'react';
import { Pressable, ActivityIndicator, View, StyleSheet, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import Text from './Text';
import { palette, radius, spacing } from '../../theme/tokens';
import { useThemeColors } from '../../theme/useThemeColors';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface Props {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

const SIZE: Record<ButtonSize, { paddingVertical: number; paddingHorizontal: number; fontSize: number }> = {
  sm: { paddingVertical: 8, paddingHorizontal: 14, fontSize: 13 },
  md: { paddingVertical: 12, paddingHorizontal: 18, fontSize: 15 },
  lg: { paddingVertical: 16, paddingHorizontal: 22, fontSize: 17 },
};

/**
 * Primary stays slate-900 (premium, brand-consistent — NOT indigo); in dark mode
 * it inverts to a light surface so it stays visible. Fires a light haptic on press.
 */
export default function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  onPress,
  style,
}: Props) {
  const { colors, isDark } = useThemeColors();
  const dims = SIZE[size];

  const { bg, fg, border } = (() => {
    switch (variant) {
      case 'secondary':
        return { bg: colors.surface, fg: colors.textPrimary, border: colors.textPrimary };
      case 'ghost':
        return { bg: 'transparent', fg: colors.textSecondary, border: 'transparent' };
      case 'danger':
        return { bg: colors.danger, fg: '#FFFFFF', border: 'transparent' };
      case 'primary':
      default:
        return {
          bg: isDark ? palette.slate50 : palette.slate900,
          fg: isDark ? palette.slate900 : '#FFFFFF',
          border: 'transparent',
        };
    }
  })();

  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border === 'transparent' ? 0 : 1.5,
          paddingVertical: dims.paddingVertical,
          paddingHorizontal: dims.paddingHorizontal,
        },
        pressed && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={styles.icon}>{icon}</View> : null}
          <Text color={fg} style={{ fontSize: dims.fontSize, fontWeight: '600' }}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  icon: { marginRight: 2 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
});
