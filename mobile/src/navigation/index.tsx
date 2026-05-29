import { NavigationContainer } from '@react-navigation/native';

import { useAuthStore } from '../store/useAuthStore';
import AuthStack from './AuthStack';
import AppStack from './AppStack';

/**
 * Root navigation container. Picks the stack based on auth state in the Zustand
 * store: signed-in users get the app stack, everyone else gets the auth stack.
 * Switching `token` in the store swaps stacks automatically.
 */
export default function Navigation() {
  const token = useAuthStore((state) => state.token);

  return (
    <NavigationContainer>
      {token ? <AppStack /> : <AuthStack />}
    </NavigationContainer>
  );
}
