import { useEffect, useRef } from 'react';
import { Animated, Easing, TouchableOpacity, Text, View, StyleSheet } from 'react-native';

import { colors } from '../theme';

interface Props {
  isSyncing: boolean;
  newActivitiesAvailable: boolean;
  syncError: boolean;
  onPress: () => void;
}

/**
 * Header sync status indicator. Idle: a subtle grey Strava "S" mark. Syncing:
 * the mark spins in Strava orange. A small dot badge sits on the corner — orange
 * for new-activities-available, red for an error. Tap routes to StravaConnect.
 *
 * Spins via the built-in Animated API (reanimated is intentionally not installed
 * — it crashed on startup in Expo Go).
 */
export default function SyncIndicator({
  isSyncing,
  newActivitiesAvailable,
  syncError,
  onPress,
}: Props) {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isSyncing) {
      spin.setValue(0);
      loop = Animated.loop(
        Animated.timing(spin, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      loop.start();
    }
    return () => {
      loop?.stop();
    };
  }, [isSyncing, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const markColor = isSyncing ? colors.primary : colors.textMuted;
  const badgeColor = syncError ? colors.danger : newActivitiesAvailable ? colors.primary : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={10}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={
        isSyncing ? 'Syncing with Strava' : syncError ? 'Sync error' : 'Strava sync status'
      }
    >
      <Animated.View
        style={[
          styles.mark,
          { borderColor: markColor },
          isSyncing && { transform: [{ rotate }] },
        ]}
      >
        <Text style={[styles.markText, { color: markColor }]}>S</Text>
      </Animated.View>
      {badgeColor ? <View style={[styles.badge, { backgroundColor: badgeColor }]} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  mark: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markText: { fontSize: 16, fontWeight: '900' },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.background,
  },
});
