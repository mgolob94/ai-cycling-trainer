import { Pressable } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Feather } from '@expo/vector-icons';

import Tabs from './Tabs';
import PlanScreen from '../screens/PlanScreen';
import StravaConnectScreen from '../screens/StravaConnectScreen';
import WeeklyComparisonScreen from '../screens/WeeklyComparisonScreen';
import RideDetailScreen from '../screens/RideDetailScreen';
import FTPTestWizard from '../screens/FTPTestWizard';
import AIReportScreen from '../screens/AIReportScreen';
import MetricsIntroScreen from '../screens/MetricsIntroScreen';
import RecoverySetupScreen from '../screens/RecoverySetupScreen';
import RecoveryScreen from '../screens/RecoveryScreen';
import DevToolsScreen from '../screens/DevToolsScreen';
import NotificationSettingsScreen from '../screens/NotificationSettingsScreen';
import CoachChatScreen from '../screens/CoachChatScreen';
import { QuickToggle } from '../components/ui';
import { fonts } from '../theme/typography';
import { useTheme } from '../theme/useTheme';
import type { AppStackParamList } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();

/** Shown once the user is signed in: bottom tabs + pushed detail screens. */
export default function AppStack() {
  const { colors } = useTheme();

  // Clean flat header: surface bg, centered heading, no shadow, Feather back.
  const headerOptions = ({ navigation }: { navigation: { canGoBack: () => boolean; goBack: () => void } }) => ({
    headerStyle: { backgroundColor: colors.surface },
    headerShadowVisible: false,
    headerTitleAlign: 'center' as const,
    headerTintColor: colors.textSecondary,
    headerTitleStyle: { fontFamily: fonts.sansSemibold, fontSize: 20, color: colors.textPrimary },
    contentStyle: { backgroundColor: colors.background },
    headerRight: () => <QuickToggle />,
    headerLeft: () =>
      navigation.canGoBack() ? (
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Feather name="chevron-left" size={26} color={colors.textSecondary} />
        </Pressable>
      ) : null,
  });

  return (
    <Stack.Navigator initialRouteName="Tabs" screenOptions={headerOptions}>
      <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
      <Stack.Screen name="TrainingPlan" component={PlanScreen} options={{ title: 'Training Plan' }} />
      <Stack.Screen name="StravaConnect" component={StravaConnectScreen} options={{ title: 'Connect Strava' }} />
      <Stack.Screen name="WeeklyComparison" component={WeeklyComparisonScreen} options={{ title: 'Weekly comparison' }} />
      <Stack.Screen name="RideDetail" component={RideDetailScreen} options={{ title: 'Ride analysis' }} />
      <Stack.Screen name="FTPTestWizard" component={FTPTestWizard} options={{ title: 'FTP test' }} />
      <Stack.Screen name="AIReport" component={AIReportScreen} options={{ title: 'AI analysis' }} />
      <Stack.Screen name="MetricsIntro" component={MetricsIntroScreen} options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="RecoverySetup" component={RecoverySetupScreen} options={{ headerShown: false, presentation: 'modal' }} />
      {/* Recovery is hidden from the tab bar (v2) but still reachable via deep links / coach. */}
      <Stack.Screen name="Recovery" component={RecoveryScreen} options={{ title: 'Recovery' }} />
      <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="CoachChat" component={CoachChatScreen} options={{ title: 'AI Coach' }} />
      {__DEV__ ? <Stack.Screen name="DevTools" component={DevToolsScreen} options={{ title: 'Dev Tools' }} /> : null}
    </Stack.Navigator>
  );
}
