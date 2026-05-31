import { useState } from 'react';
import { Pressable, Modal, View, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';

import Text from './Text';
import ThemeToggle from './ThemeToggle';
import { spacing, radius, shadows } from '../../theme/tokens';
import { useTheme, type ThemeMode } from '../../theme/useTheme';

const NEXT: Record<ThemeMode, ThemeMode> = { auto: 'light', light: 'dark', dark: 'auto' };

/**
 * Small header button. Tap cycles auto → light → dark → auto; long-press opens a
 * popover with the full 3-option ThemeToggle. Icon reflects the resolved scheme.
 */
export default function QuickToggle() {
  const { colors, isDark, mode, changeMode } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => changeMode(NEXT[mode])}
        onLongPress={() => setOpen(true)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={`Theme: ${mode}. Tap to switch, long-press for options.`}
        style={styles.btn}
      >
        <Feather name={isDark ? 'sun' : 'moon'} size={20} color={isDark ? colors.accent : colors.textSecondary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.popover, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text variant="label" color={colors.textTertiary} style={styles.title}>
              APPEARANCE
            </Text>
            <ThemeToggle />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: { padding: 6, marginRight: spacing[2] },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', paddingHorizontal: spacing[6] },
  popover: { borderRadius: radius.lg, borderWidth: 1, padding: spacing[4], gap: spacing[3], ...shadows.md },
  title: { letterSpacing: 0.6 },
});
