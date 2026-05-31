import { View, Text, StyleSheet } from 'react-native';

import { DataSource } from '../../services/dataSource';
import { palette } from '../../theme/tokens';

/**
 * Small yellow "DEMO" badge pinned top-left, shown only when the app is serving
 * mock data (dev simulator). Prevents confusing mock vs real data. Renders
 * nothing outside __DEV__ / mock mode. Uses raw RN Text (no theme dependency).
 */
export default function DemoBadge() {
  if (!__DEV__ || !DataSource.isMockMode()) return null;
  return (
    <View style={styles.badge} pointerEvents="none">
      <Text style={styles.text}>DEMO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 48,
    left: 8,
    zIndex: 9999,
    backgroundColor: palette.amber400,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  text: { color: palette.slate900, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
});
