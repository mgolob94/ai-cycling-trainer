import { View, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';

import DashboardScreen from '../screens/DashboardScreen';
import ProgressScreen from '../screens/ProgressScreen';
import RidesScreen from '../screens/RidesScreen';
import ProfileScreen from '../screens/ProfileScreen';
import { useSyncStatus } from '../hooks/useSyncStatus';
import { Text } from '../components/ui';
import { palette } from '../theme/tokens';
import { useThemeColors } from '../theme/useThemeColors';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

// route name → { label, Feather icon }
const TABS: Record<string, { label: string; icon: keyof typeof Feather.glyphMap }> = {
  Dashboard: { label: 'Home', icon: 'home' },
  Progress: { label: 'Progress', icon: 'activity' },
  Rides: { label: 'Rides', icon: 'map' },
  Profile: { label: 'Profile', icon: 'user' },
};

/**
 * Clean, editorial tab bar: white, 1px top hairline, no shadow. Active tab uses
 * slate-900 (icon + bold label) and a 2px slate-900 top border — no colored
 * pill. A small emerald dot sits on Rides when new activities are available.
 */
function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useThemeColors();
  const { newActivitiesAvailable } = useSyncStatus();

  const activeColor = isDark ? colors.textPrimary : palette.slate900;
  const inactiveColor = palette.slate400;

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: isDark ? colors.border : palette.slate100, paddingBottom: insets.bottom || 8 },
      ]}
    >
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        const color = focused ? activeColor : inactiveColor;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable key={route.key} style={styles.tab} onPress={onPress} accessibilityRole="button">
            <View
              style={[styles.topBorder, { backgroundColor: focused ? activeColor : 'transparent' }]}
            />
            <View>
              <Feather name={meta.icon} size={22} color={color} />
              {route.name === 'Rides' && newActivitiesAvailable ? <View style={styles.dot} /> : null}
            </View>
            <Text variant="label" color={color} style={[styles.label, focused && styles.labelActive]}>
              {meta.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Bottom tabs: Home, Progress, Rides, Profile. */
export default function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Progress" component={ProgressScreen} />
      <Tab.Screen name="Rides" component={RidesScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingTop: 6 },
  topBorder: { position: 'absolute', top: 0, height: 2, width: '60%', borderRadius: 2 },
  label: { fontSize: 11, letterSpacing: 0, textTransform: 'none', fontWeight: '400' },
  labelActive: { fontWeight: '600' },
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: palette.emerald400,
  },
});
