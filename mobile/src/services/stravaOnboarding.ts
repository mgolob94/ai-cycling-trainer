import AsyncStorage from '@react-native-async-storage/async-storage';

// Tracks the "Connect Strava" onboarding prompt for users who skipped linking
// Strava during sign-up. The reminder banner reappears 3 days after dismissal.
const SKIPPED_KEY = 'onboarding.stravaSkipped';
const DISMISSED_AT_KEY = 'onboarding.stravaPromptDismissedAt';
const REAPPEAR_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/** Record that the user skipped Strava during onboarding. */
export async function markStravaSkipped(): Promise<void> {
  await AsyncStorage.multiSet([
    [SKIPPED_KEY, 'true'],
    [DISMISSED_AT_KEY, ''],
  ]);
}

/** Clear all skip/prompt state — call once Strava is actually connected. */
export async function clearStravaSkipped(): Promise<void> {
  await AsyncStorage.multiRemove([SKIPPED_KEY, DISMISSED_AT_KEY]);
}

/** Snooze the reminder banner (it reappears after 3 days). */
export async function dismissStravaPrompt(): Promise<void> {
  await AsyncStorage.setItem(DISMISSED_AT_KEY, new Date().toISOString());
}

/**
 * Whether the "Connect Strava" reminder should show: the user skipped, and
 * either never dismissed the banner or dismissed it more than 3 days ago.
 */
export async function shouldShowStravaPrompt(): Promise<boolean> {
  const [[, skipped], [, dismissedAt]] = await AsyncStorage.multiGet([
    SKIPPED_KEY,
    DISMISSED_AT_KEY,
  ]);
  if (skipped !== 'true') return false;
  if (!dismissedAt) return true;
  return Date.now() - new Date(dismissedAt).getTime() > REAPPEAR_AFTER_MS;
}
