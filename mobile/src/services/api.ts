import axios from 'axios';
import Constants from 'expo-constants';

import { installDemoAdapter } from './demoAdapter';

const configuredUrl = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

/**
 * Resolve the backend base URL.
 *
 * In development we derive the host from Expo's dev-server `hostUri` (the IP the
 * Metro bundler is served on — i.e. this machine's current LAN address) and
 * reuse the port + path from `extra.apiBaseUrl` (default :3000/api). That way the
 * app follows the dev server across network/IP changes with no app.json edits.
 *
 * In a standalone/production build there's no `hostUri`, so we fall back to the
 * configured `apiBaseUrl` (a real domain), then to localhost.
 */
function resolveBaseURL(): string {
  // e.g. "192.168.1.19:8081" (sometimes prefixed with a scheme).
  const hostUri =
    Constants.expoConfig?.hostUri ?? (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost;
  const devHost = hostUri ? hostUri.split('://').pop()!.split(':')[0] : null;

  if (devHost) {
    const m = configuredUrl?.match(/^https?:\/\/[^/:]+(?::(\d+))?(\/.*)?$/);
    const port = m?.[1] ?? '3000';
    const path = m?.[2] && m[2] !== '/' ? m[2] : '/api';
    return `http://${devHost}:${port}${path}`;
  }
  return configuredUrl ?? 'http://localhost:3000/api';
}

const baseURL = resolveBaseURL();
if (__DEV__) console.log('[api] baseURL =', baseURL);

// Server origin without the /api prefix — the Strava OAuth routes are mounted
// at /auth/strava, outside /api.
export const apiOrigin = baseURL.replace(/\/api\/?$/, '');

export const api = axios.create({ baseURL });

// In demo mode, answer requests from local demo data instead of the backend.
installDemoAdapter(api);

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
