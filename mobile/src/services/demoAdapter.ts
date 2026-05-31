// Demo-mode axios adapter. While demo mode is active, requests made through the
// shared `api` instance are answered from local demo data instead of hitting a
// backend — so every data-driven screen is populated without a real account.
// Unmatched requests resolve to an empty envelope (rather than a real network
// call) so demo mode never waits on / errors against a missing server.

import axios, { type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';

import { useDemoStore } from '../store/useDemoStore';
import { MockData } from './mockData';
import {
  demoWeeklyMetrics,
  demoFtpLatest,
  demoFtpHistory,
  demoPowerCurve,
  demoRiderProfile,
  demoRecords,
  demoWeekAnalysis,
  demoRecommendations,
  demoProfile,
  demoGoals,
  demoGoalInsight,
  demoSyncStatus,
  demoCoachMessage,
} from './demoData';

function parseBody(config: InternalAxiosRequestConfig): Record<string, unknown> {
  try {
    return typeof config.data === 'string' ? JSON.parse(config.data) : (config.data ?? {});
  } catch {
    return {};
  }
}

/** Returns the demo payload for a request, or null when there's no specific match. */
function demoPayload(method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): unknown {
  if (method === 'get') {
    if (path.endsWith('/metrics/weekly')) return demoWeeklyMetrics();
    if (path.endsWith('/ftp/latest')) return demoFtpLatest();
    if (path.endsWith('/ftp/history')) return demoFtpHistory();
    if (path.endsWith('/pdc/compare')) return demoPowerCurve(Number(query.get('weeks')) || 13);
    if (path.endsWith('/profile/rider-type')) return demoRiderProfile();
    if (path.endsWith('/records')) return demoRecords();
    if (path.endsWith('/ai/week-analysis')) return demoWeekAnalysis();
    if (path.endsWith('/recommendations')) return demoRecommendations();
    if (path.endsWith('/users/me')) return demoProfile();
    if (path.endsWith('/goals')) return demoGoals();
    if (path.endsWith('/sync/status')) return demoSyncStatus();
    if (path.endsWith('/rides')) return MockData.rides(Number(query.get('limit')) || 50);
    return null;
  }
  if (method === 'post') {
    if (path.endsWith('/ftp/calculate')) return { ftp_watts: 287, recorded: false };
    if (path.endsWith('/records/scan')) return demoRecords();
    if (/\/goals\/[^/]+\/insight$/.test(path)) return demoGoalInsight(path.split('/').slice(-2)[0]);
    if (path.endsWith('/goals')) {
      return {
        id: `demo-goal-${Date.now()}`,
        goal_type: body.goal_type ?? 'ftp_target',
        title: body.title ?? null,
        target_date: body.target_date ?? null,
        target_ftp: body.target_ftp ?? null,
        target_distance_km: body.target_distance_km ?? null,
        target_event_name: body.target_event_name ?? null,
        current_progress: 0,
        status: 'active',
        created_at: new Date().toISOString(),
      };
    }
    if (path.endsWith('/coach/message')) return demoCoachMessage(String(body.message ?? ''));
    return null;
  }
  return null;
}

/**
 * Installs the demo adapter on the given axios instance. The original adapter is
 * resolved and used as the fall-through when demo mode is off.
 */
export function installDemoAdapter(instance: typeof axios | ReturnType<typeof axios.create>) {
  const base: AxiosAdapter = axios.getAdapter(instance.defaults.adapter ?? axios.defaults.adapter);

  instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    if (!useDemoStore.getState().demo) return base(config);

    let url = config.url || '';
    if (!/^https?:\/\//.test(url)) url = (config.baseURL || '') + url;
    const [rawPath, rawQuery = ''] = url.replace(/^https?:\/\/[^/]+/, '').split('?');
    const method = (config.method || 'get').toLowerCase();
    const payload = demoPayload(method, rawPath, new URLSearchParams(rawQuery), parseBody(config));

    return {
      data: { success: true, data: payload, error: null },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
}
