import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from '../screens/DashboardScreen';
import PlanScreen from '../screens/PlanScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StravaConnectScreen from '../screens/StravaConnectScreen';
import ProgressScreen from '../screens/ProgressScreen';
import WeeklyComparisonScreen from '../screens/WeeklyComparisonScreen';
import type { AppStackParamList } from './types';
import { lightColors } from '../theme';

const lightHeader = {
  headerStyle: { backgroundColor: lightColors.surface },
  headerTintColor: lightColors.text,
  headerTitleStyle: { color: lightColors.text },
  headerShadowVisible: true,
  contentStyle: { backgroundColor: lightColors.background },
};

const Stack = createNativeStackNavigator<AppStackParamList>();

/** Shown once the user is signed in. */
export default function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Dashboard">
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen
        name="TrainingPlan"
        component={PlanScreen}
        options={{ title: 'Training Plan' }}
      />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen
        name="StravaConnect"
        component={StravaConnectScreen}
        options={{ title: 'Connect Strava' }}
      />
      {/* Light-themed screens — override the dark stack header to match. */}
      <Stack.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: 'Progress', ...lightHeader }}
      />
      <Stack.Screen
        name="WeeklyComparison"
        component={WeeklyComparisonScreen}
        options={{ title: 'Weekly comparison', ...lightHeader }}
      />
    </Stack.Navigator>
  );
}
