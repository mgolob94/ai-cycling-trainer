// Route param lists for the two navigation stacks. Screens import these for
// typed navigation props.

export type AuthStackParamList = {
  Welcome: undefined;
  SignUp: undefined;
  ProfileSetup: undefined;
  Login: undefined;
};

export type AppStackParamList = {
  Dashboard: undefined;
  TrainingPlan: undefined;
  Profile: undefined;
  StravaConnect: undefined;
  Progress: undefined;
  WeeklyComparison: undefined;
  RideDetail: { stravaId: string };
  Periodization: undefined;
  FTPTestWizard: undefined;
};
