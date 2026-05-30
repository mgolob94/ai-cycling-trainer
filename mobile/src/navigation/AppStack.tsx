import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import Tabs from './Tabs';
import PlanScreen from '../screens/PlanScreen';
import StravaConnectScreen from '../screens/StravaConnectScreen';
import WeeklyComparisonScreen from '../screens/WeeklyComparisonScreen';
import RideDetailScreen from '../screens/RideDetailScreen';
import PeriodizationScreen from '../screens/PeriodizationScreen';
import FTPTestWizard from '../screens/FTPTestWizard';
import AIReportScreen from '../screens/AIReportScreen';
import { fonts } from '../theme/typography';
import { palette } from '../theme/tokens';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

// Clean flat header: white, centered heading, hairline bottom border, no shadow,
// Feather chevron-left back button.
const headerOptions = ({ navigation }: { navigation: { canGoBack: () => boolean; goBack: () => void } }) => ({
  headerStyle: { backgroundColor: palette.slate50 },
  headerShadowVisible: false,
  headerTitleAlign: 'center' as const,
  headerTintColor: palette.slate600,
  headerTitleStyle: { fontFamily: fonts.sansSemibold, fontSize: 20, color: palette.slate900 },
  contentStyle: { backgroundColor: '#FAFAF9' },
  headerLeft: () =>
    navigation.canGoBack() ? (
      <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
        <Feather name="chevron-left" size={26} color={palette.slate600} />
      </Pressable>
    ) : null,
});

/** Shown once the user is signed in: bottom tabs + pushed detail screens. */
export default function AppStack() {
  return (
    <Stack.Navigator initialRouteName="Tabs" screenOptions={headerOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="TrainingPlan" component={PlanScreen} options={{ title: 'Training Plan' }} />
      <Stack.Screen name="StravaConnect" component={StravaConnectScreen} options={{ title: 'Connect Strava' }} />
      <Stack.Screen name="WeeklyComparison" component={WeeklyComparisonScreen} options={{ title: 'Weekly comparison' }} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: 'Ride analysis' }} />
      <Stack.Screen name="Periodization" component={PeriodizationScreen} options={{ title: 'Season plan' }} />
      <Stack.Screen name="FTPTestWizard" component={FTPTestWizard} options={{ title: 'FTP test' }} />
      <Stack.Screen name="AIReport" component={AIReportScreen} options={{ title: 'AI analysis' }} />
    </Stack.Navigator>
  );
}
