import axios from 'axios';
import Constants from 'expo-constants';

const baseURL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? 'http://localhost:3000/api';

export const api = axios.create({ baseURL });

/** Attach the Supabase access token to every request once it's known. */
export function setAuthToken(token: string | null) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

/** Standard backend envelope: { success, data, error }. */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
