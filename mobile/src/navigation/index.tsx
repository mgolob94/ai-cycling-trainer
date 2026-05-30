import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';

import { useAuthStore } from '../store/useAuthStore';
import AuthStack from './AuthStack';
import AppStack from './AppStack';
import { navigationRef } from './navigationRef';
import { navigationTheme } from '../theme/tokens';

export { navigationRef };

// Light Antracit/Slate navigation theme (design system). Dark mode is handled
// per-screen via useThemeColors; prompt 9 promotes this to a system-driven theme.
const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    ...navigationTheme.colors,
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
