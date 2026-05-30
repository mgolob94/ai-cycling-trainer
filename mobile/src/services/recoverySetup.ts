import AsyncStorage from '@react-native-async-storage/async-storage';

// One-time Recovery setup, shown the first time the user opens the Recovery tab.
const SEEN_KEY = 'recoverySetup.seen';

export async function hasSeenRecoverySetup(): Promise<boolean> {
  return (await AsyncStorage.getItem(SEEN_KEY)) === 'true';
}

export async function markRecoverySetupSeen(): Promise<void> {
  await AsyncStorage.setItem(SEEN_KEY, 'true');
}
