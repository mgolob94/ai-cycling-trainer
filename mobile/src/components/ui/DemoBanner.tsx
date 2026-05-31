import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useDemoStore } from '../../store/useDemoStore';
import { palette } from '../../theme/tokens';

/**
 * Persistent, non-dismissible demo-mode banner pinned to the top of every
 * screen while demo mode is active. Tapping it exits demo → back to the auth
 * flow (signup). Raw RN Text (theme-independent).
 */
export default function DemoBanner() {
  const demo = useDemoStore((s) => s.demo);
  const exitDemo = useDemoStore((s) => s.exitDemo);
  const insets = useSafeAreaInsets();

  if (!demo) return null;
  return (
    <Pressable style={[styles.bar, { paddingTop: insets.top + 4 }]} onPress={exitDemo}>
      <Text style={styles.text}>DEMO MODE — Simulated data</Text>
      <Text style={styles.cta}>Create real account →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9998,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: palette.amber50,
    borderBottomWidth: 1,
    borderBottomColor: palette.amber400,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  text: { color: palette.amber600, fontSize: 12, fontWeight: '700' },
  cta: { color: palette.amber600, fontSize: 12, fontWeight: '800' },
});
