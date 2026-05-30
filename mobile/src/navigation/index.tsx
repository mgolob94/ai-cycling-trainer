import {
  NavigationContainer,
  DarkTheme,
  createNavigationContainerRef,
  type Theme,
} from '@react-navigation/native';

import { useAuthStore } from '../store/useAuthStore';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import type { AppStackParamList } from './types';
import { colors } from '../theme';

// Ref so non-React code (e.g. notification taps) can navigate.
export const navigationRef = createNavigationContainerRef<AppStackParamList>();

const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.border,
    primary: colors.primary,
  },
};

/**
 * Root navigation container. Picks the stack based on auth state in the Zustand
 * store: signed-in users get the app stack, everyone else gets the auth stack.
 * Switching `token` in the store swaps stacks automatically.
 */
export default function Navigation() {
  const token = useAuthStore((state) => state.token);

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {token ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
