import { Pressable, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import { useDemoStore } from '../../store/useDemoStore';
import { Text } from '../ui';
import { palette, spacing, radius, shadows } from '../../theme/tokens';
import type { AppStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AppStackParamList>;

/**
 * Floating "Ask coach" button — a primary entry point to the AI coach chat,
 * docked bottom-right above the tab bar on the main screens. Raised when the
 * demo banner is showing so it clears it. Theme-independent (always dark pill).
 */
export default function CoachFab() {
  const navigation = useNavigation<Nav>();
  const demo = useDemoStore((s) => s.demo);

  return (
    <Pressable
      style={[styles.fab, { bottom: spacing[4] + (demo ? 44 : 0) }]}
      onPress={() => navigation.navigate('CoachChat')}
      accessibilityRole="button"
      accessibilityLabel="Ask your AI coach"
    >
      <Feather name="message-circle" size={22} color="#FFFFFF" />
      <Text variant="label" color="#FFFFFF" style={styles.label}>
        Coach
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: spacing[4],
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: palette.slate900,
    paddingLeft: spacing[4],
    paddingRight: spacing[5],
    paddingVertical: spacing[3],
    borderRadius: radius.full,
    ...shadows.md,
  },
  label: { letterSpacing: 0.3 },
});
