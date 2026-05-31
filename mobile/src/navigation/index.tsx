import { NavigationContainer, DefaultTheme, DarkTheme, type Theme } from '@react-navigation/native';

import { useAuthStore } from '../store/useAuthStore';
import { useDemoStore } from '../store/useDemoStore';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import { navigationRef } from './navigationRef';
import { useTheme } from '../theme/useTheme';

export { navigationRef };

/**
 * Root navigation container. Picks the stack based on auth state in the Zustand
 * store: signed-in users get the app stack, everyone else gets the auth stack.
 * The container theme follows the active light/dark theme.
 */
export default function Navigation() {
  const token = useAuthStore((state) => state.token);
  const demo = useDemoStore((state) => state.demo);
  const { colors, isDark } = useTheme();

  const navTheme: Theme = {
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.textPrimary,
      border: colors.border,
      notification: colors.accent,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      {token || demo ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
