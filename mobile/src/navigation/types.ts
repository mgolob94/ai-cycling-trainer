// Route param lists for the two navigation stacks. Screens import these for
// typed navigation props.

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  ProfileSetup: undefined;
  StravaSetup: undefined;
  Login: undefined;
};

import type { NavigatorScreenParams } from '@react-navigation/native';

// Bottom-tab navigator routes.
export type TabParamList = {
  Dashboard: undefined;
  Progress: undefined;
  Recovery: undefined;
  Rides: undefined;
  Profile: undefined;
};

export type AppStackParamList = {
  // Nested bottom-tab navigator
  Tabs: NavigatorScreenParams<TabParamList>;
  // Tab routes are also listed here so screens typed against AppStackParamList
  // can navigate to them directly (resolved via the nested navigator at runtime).
  Dashboard: undefined;
  Progress: undefined;
  Recovery: undefined;
  Rides: undefined;
  Profile: undefined;
  // Stack-only detail routes
  TrainingPlan: undefined;
  StravaConnect: undefined;
  WeeklyComparison: undefined;
  RideDetail: { stravaId: string };
  Periodization: undefined;
  FTPTestWizard: undefined;
  AIReport: undefined;
  MetricsIntro: undefined;
  RecoverySetup: undefined;
  NotificationSettings: undefined;
  CoachChat: undefined;
  DevTools: undefined;
};
