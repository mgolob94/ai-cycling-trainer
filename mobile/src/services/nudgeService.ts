import AsyncStorage from '@react-native-async-storage/async-storage';

// Rule-based, timely tips. NOT AI-generated (no tokens). Surfaced as banners,
// cards, or chips at the right moment. Copy is English.

export type NudgePriority = 'high' | 'medium' | 'low';

export interface Nudge {
  id: string;
  message: string;
  detail: string;
  priority: NudgePriority;
  icon: string;
  action: { label: string; screen: string } | null;
}

export interface NudgeMetrics {
  tsb: number;
  ctl: number;
  atl: number;
  /** CTL ~4 weeks ago, for monthly-progress detection. */
  ctlMonthAgo: number | null;
  /** Recent weekly TSS, oldest→newest, for decline detection. */
  weeklyTss: number[];
  daysSinceFtpTest: number | null;
  wattsPerKg: number | null;
  /** W/kg at the previous FTP test, for threshold-crossing detection. */
  prevWattsPerKg: number | null;
  /** Consecutive days with a ride (if known). */
  consecutiveRideDays?: number;
}

const WKG_THRESHOLDS = [3.0, 3.5, 4.0, 4.5, 5.0];

/** Evaluate all rules against the current metrics and return matching nudges. */
export function checkNudges(metrics: NudgeMetrics): Nudge[] {
  const out: Nudge[] = [];
  const { tsb, ctl, atl, ctlMonthAgo, weeklyTss, daysSinceFtpTest, wattsPerKg, prevWattsPerKg } = metrics;

  // ---- Recovery (high) ----
  if (tsb < -20) {
    out.push({
      id: 'recovery-low-tsb',
      message: 'Your body is asking for rest',
      detail: 'Take it easy today — a light ride or a day off the bike.',
      priority: 'high',
      icon: '😴',
      action: null,
    });
  }
  if (atl > ctl + 15) {
    out.push({
      id: 'recovery-fast-ramp',
      message: 'You ramped up quickly',
      detail: 'Fatigue is well above your fitness — injury risk is higher. Ease off a little.',
      priority: 'high',
      icon: '⚠️',
      action: null,
    });
  }
  if ((metrics.consecutiveRideDays ?? 0) >= 7 && atl > ctl) {
    out.push({
      id: 'recovery-no-rest',
      message: '7 days straight without rest',
      detail: 'Add at least one rest day per week to absorb the training.',
      priority: 'high',
      icon: '🛑',
      action: null,
    });
  }

  // ---- Progress (medium) ----
  if (daysSinceFtpTest != null && daysSinceFtpTest > 42) {
    out.push({
      id: 'progress-ftp-stale',
      message: 'Time for an FTP test?',
      detail: `It's been ${daysSinceFtpTest} days since your last test — you may have improved.`,
      priority: 'medium',
      icon: '⚡',
      action: { label: 'Start FTP test', screen: 'FTPTestWizard' },
    });
  }
  if (ctlMonthAgo != null && ctl - ctlMonthAgo > 10) {
    out.push({
      id: 'progress-ctl-jump',
      message: 'Great progress this month! 🎉',
      detail: `Your fitness rose ${Math.round(ctl - ctlMonthAgo)} points in the last month.`,
      priority: 'medium',
      icon: '📈',
      action: { label: 'View progress', screen: 'Progress' },
    });
  }
  if (weeklyTss.length >= 3) {
    const [a, b, c] = weeklyTss.slice(-3);
    if (a > b && b > c) {
      out.push({
        id: 'progress-tss-decline',
        message: 'Training has tapered off',
        detail: "Your load has dropped 3 weeks running. Everything ok?",
        priority: 'medium',
        icon: '📉',
        action: null,
      });
    }
  }

  // ---- Performance (low) ----
  if (wattsPerKg != null && prevWattsPerKg != null) {
    const crossed = WKG_THRESHOLDS.find((t) => prevWattsPerKg < t && wattsPerKg >= t);
    if (crossed) {
      out.push({
        id: `perf-wkg-${crossed}`,
        message: `You crossed ${crossed.toFixed(1)} W/kg!`,
        detail: 'A new power-to-weight milestone — nice work.',
        priority: 'low',
        icon: '🏆',
        action: { label: 'View progress', screen: 'Progress' },
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Dismissal persistence. High-priority nudges reappear after 24h; medium/low
// stay dismissed once acknowledged.
// ---------------------------------------------------------------------------
const KEY = 'nudges.dismissed';
const HIGH_REAPPEAR_MS = 24 * 60 * 60 * 1000;

type DismissMap = Record<string, number>; // id → dismissedAt (ms)

async function readDismissed(): Promise<DismissMap> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DismissMap) : {};
  } catch {
    return {};
  }
}

export async function dismissNudge(id: string): Promise<void> {
  const map = await readDismissed();
  map[id] = Date.now();
  await AsyncStorage.setItem(KEY, JSON.stringify(map));
}

/**
 * Filter out dismissed nudges (high ones reappear after 24h) and cap the result
 * at `max` (default 2) to avoid overwhelming the user.
 */
export async function filterDismissed(nudges: Nudge[], max = 2): Promise<Nudge[]> {
  const map = await readDismissed();
  const now = Date.now();
  const visible = nudges.filter((n) => {
    const at = map[n.id];
    if (!at) return true;
    return n.priority === 'high' ? now - at > HIGH_REAPPEAR_MS : false;
  });
  const order: Record<NudgePriority, number> = { high: 0, medium: 1, low: 2 };
  visible.sort((a, b) => order[a.priority] - order[b.priority]);
  return visible.slice(0, max);
}
