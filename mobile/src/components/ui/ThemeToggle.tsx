import { View, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import { spacing, radius, shadows } from '../../theme/tokens';
import { useTheme, type ThemeMode } from '../../theme/useTheme';

const OPTIONS: { mode: ThemeMode; label: string; icon?: keyof typeof Feather.glyphMap }[] = [
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'auto', label: 'Auto', icon: 'smartphone' },
];

interface Props {
  /** Controlled mode; defaults to the active theme mode from context. */
  currentMode?: ThemeMode;
  /** Change handler; defaults to the theme's changeMode. */
  onChange?: (mode: ThemeMode) => void;
}

/** 3-option segmented control for picking auto / light / dark. */
export default function ThemeToggle({ currentMode, onChange }: Props) {
  const { colors, isDark, mode, changeMode } = useTheme();
  const active = currentMode ?? mode;
  const set = onChange ?? changeMode;

  const select = (m: ThemeMode) => {
    LayoutAnimation.configureNext(LayoutAnimation.create(160, 'easeInEaseOut', 'opacity'));
    set(m);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceRaised }]}>
      {OPTIONS.map((o) => {
        const isActive = active === o.mode;
        return (
          <Pressable
            key={o.mode}
            onPress={() => select(o.mode)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${o.label} theme`}
            style={[styles.option, isActive && { backgroundColor: isDark ? colors.surface : '#FFFFFF', ...shadows.sm }]}
          >
            {o.icon ? <Feather name={o.icon} size={14} color={isActive ? colors.accent : colors.textTertiary} /> : null}
            <Text variant="label" color={isActive ? colors.accent : colors.textSecondary} style={styles.label}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: radius.md, padding: 3, gap: 3 },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingVertical: spacing[2],
    borderRadius: radius.sm,
  },
  label: { letterSpacing: 0.2 },
});
