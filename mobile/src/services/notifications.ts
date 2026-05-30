import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { api } from './api';
import { navigationRef } from '../navigation/navigationRef';

const SETTINGS_KEY = 'notification_settings';
const REMINDER_ID_KEY = 'reminder_notification_id';
const WEEKLY_SUMMARY_ID_KEY = 'weekly_summary_notification_id';
const ANDROID_CHANNEL_ID = 'workout-reminders';

export interface NotificationSettings {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const DEFAULT_SETTINGS: NotificationSettings = { enabled: false, hour: 18, minute: 0 };

// Foreground presentation: show the alert + play a sound even when the app is
// open. (Background/closed delivery is handled by the OS.)
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Persisted reminder settings (enabled + time of day). */
export async function getSettings(): Promise<NotificationSettings> {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveSettings(settings: NotificationSettings): Promise<void> {
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Ensure an Android notification channel exists (no-op on iOS). */
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Workout reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/**
 * Request notification permissions. Returns whether they were granted. Safe to
 * call on every app start — it won't re-prompt once a choice is made.
 */
export async function requestPermissions(): Promise<boolean> {
  if (!Device.isDevice) return false;
  await ensureAndroidChannel();

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (existing !== 'granted') {
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  return status === 'granted';
}

/**
 * Get the Expo push token and register it with the backend. Requires the user
 * to be authenticated (the API client must already carry the bearer token).
 * Silently no-ops if permissions are denied or no EAS projectId is configured.
 */
export async function registerPushToken(): Promise<string | null> {
  const granted = await requestPermissions();
  if (!granted) return null;

  const projectId =
    (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ??
    (Constants.easConfig?.projectId as string | undefined);
  if (!projectId) {
    console.warn('[notifications] No EAS projectId — skipping push token registration.');
    return null;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api.post('/users/push-token', { token, platform: Platform.OS });
    return token;
  } catch (e) {
    console.warn('[notifications] Failed to register push token:', e);
    return null;
  }
}

/**
 * Schedule (or reschedule) the daily workout reminder at the given time. Cancels
 * any previously scheduled reminder first so there's only ever one.
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  await cancelDailyReminder();
  await ensureAndroidChannel();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Time to train 🚴',
      body: "Your workout is waiting — let's get the ride in.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  await AsyncStorage.setItem(REMINDER_ID_KEY, id);
  await saveSettings({ enabled: true, hour, minute });
}

/** Cancel the scheduled daily reminder, if any. */
export async function cancelDailyReminder(): Promise<void> {
  const id = await AsyncStorage.getItem(REMINDER_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(REMINDER_ID_KEY);
  }
}

/**
 * Schedule (or refresh) the weekly summary notification for Sunday evening.
 * The week's totals are embedded at schedule time, so call this when fresh data
 * is available (e.g. after loading metrics) to keep the numbers current.
 * No-op if notification permission hasn't been granted (won't prompt).
 */
export async function scheduleWeeklySummary(distanceKm: number, tss: number): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  await cancelWeeklySummary();
  await ensureAndroidChannel();

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Your week 🚴',
      body: `${Math.round(distanceKm)} km, ${Math.round(tss)} TSS. Let's review your progress!`,
      data: { screen: 'Progress' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: 1, // 1 = Sunday
      hour: 18,
      minute: 0,
      ...(Platform.OS === 'android' ? { channelId: ANDROID_CHANNEL_ID } : {}),
    },
  });

  await AsyncStorage.setItem(WEEKLY_SUMMARY_ID_KEY, id);
}

/** Cancel the weekly summary notification, if scheduled. */
export async function cancelWeeklySummary(): Promise<void> {
  const id = await AsyncStorage.getItem(WEEKLY_SUMMARY_ID_KEY);
  if (id) {
    await Notifications.cancelScheduledNotificationAsync(id);
    await AsyncStorage.removeItem(WEEKLY_SUMMARY_ID_KEY);
  }
}

/** Turn reminders on/off, keeping the stored time. */
export async function setRemindersEnabled(
  enabled: boolean,
  hour: number,
  minute: number
): Promise<boolean> {
  if (enabled) {
    const granted = await requestPermissions();
    if (!granted) return false;
    await scheduleDailyReminder(hour, minute);
  } else {
    await cancelDailyReminder();
    await saveSettings({ enabled: false, hour, minute });
  }
  return true;
}

/**
 * Register foreground + background notification listeners. Returns an unsubscribe
 * function — call it on unmount.
 */
export function addNotificationListeners(): () => void {
  // App in foreground: fired when a notification arrives.
  const received = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[notifications] received in foreground:', notification.request.content.title);
  });

  // App in background / killed: fired when the user taps a notification.
  // If the notification carries a `screen`, deep-link to it.
  const TAB_ROUTES = ['Dashboard', 'Progress', 'Rides', 'Profile'];
  const response = Notifications.addNotificationResponseReceivedListener((res) => {
    const data = res.notification.request.content.data as { screen?: string } | undefined;
    if (data?.screen && navigationRef.isReady()) {
      // Tab destinations live in the nested Tabs navigator; everything else is a
      // top-level stack route.
      if (TAB_ROUTES.includes(data.screen)) {
        // @ts-expect-error nested screen name is validated at the navigator level
        navigationRef.navigate('Tabs', { screen: data.screen });
      } else {
        // @ts-expect-error screen name is validated at the navigator level
        navigationRef.navigate(data.screen);
      }
    }
  });

  return () => {
    received.remove();
    response.remove();
  };
}

/**
 * Call once on app start: request permissions and, if reminders are enabled,
 * make sure the daily reminder is scheduled.
 */
export async function initNotifications(): Promise<void> {
  await requestPermissions();
  const settings = await getSettings();
  if (settings.enabled) {
    await scheduleDailyReminder(settings.hour, settings.minute);
  }
}
