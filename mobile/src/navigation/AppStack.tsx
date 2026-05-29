import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from '../screens/DashboardScreen';
import PlanScreen from '../screens/PlanScreen';
import ProfileScreen from '../screens/ProfileScreen';
import StravaConnectScreen from '../screens/StravaConnectScreen';
import type { AppStackParamList } from './types';

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
    </Stack.Navigator>
  );
}
