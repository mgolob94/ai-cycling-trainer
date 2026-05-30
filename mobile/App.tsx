import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';

import Navigation from './src/navigation';
import { useAuthStore } from './src/store/useAuthStore';
import { ThemeProvider } from './src/theme/useTheme';
import { fontAssets } from './src/theme/typography';
import {
  initNotifications,
  addNotificationListeners,
  registerPushToken,
} from './src/services/notifications';

export default function App() {
  const token = useAuthStore((state) => state.token);

  // Load the custom UI + stat fonts before rendering so text doesn't flash in a
  // system font first. Proceed on error too — falling back to system fonts is
  // better than blocking the whole app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  // On start: request permissions, reschedule reminders, and wire foreground/
  // background notification listeners.
  useEffect(() => {
    initNotifications();
    const unsubscribe = addNotificationListeners();
    return unsubscribe;
  }, []);

  // Register this device's push token once the user is authenticated.
  useEffect(() => {
    if (token) {
      registerPushToken().catch(() => {});
    }
  }, [token]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <Navigation />
        <StatusBar style="auto" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}
