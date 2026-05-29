import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import Navigation from './src/navigation';
import { useAuthStore } from './src/store/useAuthStore';
import {
  initNotifications,
  addNotificationListeners,
  registerPushToken,
} from './src/services/notifications';

export default function App() {
  const token = useAuthStore((state) => state.token);

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

  return (
    <SafeAreaProvider>
      <Navigation />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
