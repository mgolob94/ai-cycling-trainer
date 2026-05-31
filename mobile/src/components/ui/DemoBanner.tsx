import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDemoStore } from '../../store/useDemoStore';
import { palette } from '../../theme/tokens';

// Approx. content height of the custom bottom tab bar (excluding the safe-area
// inset), kept in sync with navigation/Tabs.tsx. The banner sits just above it.
const TAB_BAR_CONTENT = 51;

/**
 * Persistent, non-dismissible demo-mode banner docked just above the bottom tab
 * bar while demo mode is active (kept off the top so it never covers the
 * navigation header, and above the tabs so they stay tappable). Tapping it exits
 * demo → back to the auth flow (signup). Raw RN Text (theme-independent).
 */
export default function DemoBanner() {
  const demo = useDemoStore((s) => s.demo);
  const exitDemo = useDemoStore((s) => s.exitDemo);
  const insets = useSafeAreaInsets();

  if (!demo) return null;
  const tabBarHeight = TAB_BAR_CONTENT + (insets.bottom || 8);
  return (
    <Pressable style={[styles.bar, { bottom: tabBarHeight }]} onPress={exitDemo}>
      <Text style={styles.text}>DEMO MODE — Simulated data</Text>
      <Text style={styles.cta}>Create real account →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9998,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.amber50,
    borderTopWidth: 1,
    borderTopColor: palette.amber400,
    borderBottomWidth: 1,
    borderBottomColor: palette.amber400,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  text: { color: palette.amber600, fontSize: 12, fontWeight: '700' },
  cta: { color: palette.amber600, fontSize: 12, fontWeight: '800' },
});
