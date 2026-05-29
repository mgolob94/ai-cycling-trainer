import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};
const supabaseUrl = (extra.supabaseUrl as string) ?? '';
const supabaseAnonKey = (extra.supabaseAnonKey as string) ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaced in the Metro logs — fill these into app.json → expo.extra.
  console.warn('[supabase] supabaseUrl / supabaseAnonKey are not set in app.json extra.');
}

/**
 * Supabase client for the mobile app. Sessions are persisted with AsyncStorage
 * and auto-refreshed. detectSessionInUrl is off — there's no URL to parse in a
 * native app.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
