// Deterministic demo-mode payloads. These mirror the backend response shapes so
// that, while demo mode is active, the data-driven screens (Progress, Dashboard,
// Goals, Coach) are fully populated without a real account or backend.
//
// Consumed only by the demo axios adapter (see ./api.ts) — never imported by
// screens/hooks directly. Reuses MockData for rides/FTP/user where possible so
// the numbers stay consistent with the rest of demo mode. Copy is English.

import { MockData } from './mockData';

const FTP = 287;
const WEIGHT = 72;

function mondayWeeksAgo(weeksAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() + ((day === 0 ? -6 : 1) - day) - weeksAgo * 7);
  return d.toISOString().slice(0, 10);
}
function daysAgoDate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
const round = (n: number, dp = 0) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// --- Weekly training-load metrics (12 weeks, progressive build) -------------
// Weekly TSS with a recovery week every 4th; CTL/ATL via daily EWMA.
const WEEK_TSS = [350, 380, 410, 250, 400, 430, 470, 290, 460, 500, 330, 440];

export function demoWeeklyMetrics() {
  let ctl = 40;
  let atl = 40;
  const out = [];
  for (let i = 0; i < WEEK_TSS.length; i += 1) {
    const tss = WEEK_TSS[i];
    const daily = tss / 7;
    for (let d = 0; d < 7; d += 1) {
      ctl += (daily - ctl) / 42;
      atl += (daily - atl) / 7;
    }
    const weeksAgo = WEEK_TSS.length - 1 - i;
    const rideCount = tss < 320 ? 3 : tss > 460 ? 5 : 4;
    const distance = round(tss * 0.42, 1);
    out.push({
      week_start: mondayWeeksAgo(weeksAgo),
      tss,
      atl: round(atl, 1),
      ctl: round(ctl, 1),
      tsb: round(ctl - atl, 1),
      total_distance_km: distance,
      total_duration_sec: Math.round(distance / 28 * 3600),
      total_elevation_m: Math.round(distance * 11),
      avg_power_w: Math.round(FTP * 0.74),
      ride_count: rideCount,
    });
  }
  return out;
}

// --- FTP --------------------------------------------------------------------
function ftpTests() {
  return MockData.ftpHistory().map((t) => ({ ...t, weight_kg: WEIGHT }));
}
export function demoFtpLatest() {
  const all = ftpTests();
  return all[all.length - 1] ?? null;
}
export function demoFtpHistory() {
  return ftpTests();
}

// --- Power-duration curve ---------------------------------------------------
const PDC_POINTS: Array<{ duration_sec: number; duration_label: string; power_watts: number }> = [
  { duration_sec: 5, duration_label: '5s', power_watts: 980 },
  { duration_sec: 15, duration_label: '15s', power_watts: 760 },
  { duration_sec: 30, duration_label: '30s', power_watts: 610 },
  { duration_sec: 60, duration_label: '1min', power_watts: 470 },
  { duration_sec: 300, duration_label: '5min', power_watts: 348 },
  { duration_sec: 480, duration_label: '8min', power_watts: 322 },
  { duration_sec: 1200, duration_label: '20min', power_watts: 302 },
  { duration_sec: 3600, duration_label: '60min', power_watts: 271 },
];

export function demoPowerCurve(weeks: number) {
  // Recent windows sit a touch below the all-time bests; tighter for 4 weeks.
  const recentFactor = weeks <= 4 ? 0.93 : 0.97;
  const alltime = PDC_POINTS.map((p) => ({ ...p, achieved_date: daysAgoDate(40 + p.duration_sec / 60) }));
  const recent = PDC_POINTS.map((p) => ({
    ...p,
    power_watts: Math.round(p.power_watts * recentFactor),
    achieved_date: daysAgoDate(weeks <= 4 ? 9 : 20),
  }));
  return { alltime, recent };
}

// --- Rider type -------------------------------------------------------------
export function demoRiderProfile() {
  const radar = [
    { duration_sec: 5, label: 'Sprint', power_watts: 980, value_pct: 88, ideal_pct: 75 },
    { duration_sec: 60, label: '1min', power_watts: 470, value_pct: 82, ideal_pct: 78 },
    { duration_sec: 300, label: '5min', power_watts: 348, value_pct: 74, ideal_pct: 80 },
    { duration_sec: 1200, label: '20min', power_watts: 302, value_pct: 71, ideal_pct: 82 },
    { duration_sec: 3600, label: '60min', power_watts: 271, value_pct: 68, ideal_pct: 80 },
  ];
  return {
    rider_type: 'all_rounder',
    label: 'All-Rounder',
    icon: '🚴',
    description: 'A balanced profile with no glaring weakness — strong over short efforts and steady on longer climbs.',
    strengths: ['Repeatable short efforts', 'Solid threshold power', 'Good aerobic base'],
    weaknesses: ['Long sustained climbs', 'Top-end 5-min ceiling'],
    recommendations: ['Add weekly VO2max intervals to lift your 5-min power', 'Keep building CTL with one long Zone 2 ride per week'],
    radar,
    goal_alignment: 'Your endurance goal fits your profile — prioritize threshold and tempo work.',
  };
}

// --- Personal records -------------------------------------------------------
export function demoRecords() {
  return [
    { record_type: 'max_power', value: 1024, unit: 'W', strava_activity_id: 'mock-1000003', achieved_date: daysAgoDate(12) },
    { record_type: 'best_1min', value: 478, unit: 'W', strava_activity_id: 'mock-1000007', achieved_date: daysAgoDate(26) },
    { record_type: 'best_5min', value: 346, unit: 'W', strava_activity_id: 'mock-1000011', achieved_date: daysAgoDate(33) },
    { record_type: 'best_20min', value: 301, unit: 'W', strava_activity_id: 'mock-1000004', achieved_date: daysAgoDate(40) },
    { record_type: 'longest_ride', value: 142.6, unit: 'km', strava_activity_id: 'mock-1000002', achieved_date: daysAgoDate(19) },
    { record_type: 'most_elevation', value: 1840, unit: 'm', strava_activity_id: 'mock-1000002', achieved_date: daysAgoDate(19) },
  ];
}

// --- AI week analysis -------------------------------------------------------
export function demoWeekAnalysis() {
  return {
    summary:
      "Strong week — you held a steady build and your form is trending up. CTL is climbing without spiking fatigue, which is exactly where we want it heading into the next block.",
    form_status: 'optimal' as const,
    key_insight: 'Your threshold work is paying off: 20-min power is up ~4% over the last month.',
    recommendation: 'Keep the long Zone 2 ride on the weekend and add one VO2max session midweek.',
    next_week_tss_target: 460,
    warning: null,
    _cached: true,
    _generated_at: new Date().toISOString(),
  };
}

// --- Recommendations --------------------------------------------------------
export function demoRecommendations() {
  return [
    { type: 'recovery', message: 'Your form (TSB) is positive — a good window for a hard interval session.', priority: 'medium' as const, action_cta: 'Plan intervals' },
    { type: 'ftp', message: "It's been 4 weeks since your last FTP test. Re-test to keep your zones accurate.", priority: 'high' as const, action_cta: 'Run FTP test' },
    { type: 'consistency', message: "You're averaging 4 rides/week — right on target for your goal.", priority: 'low' as const, action_cta: 'View plan' },
  ];
}

// --- Profile (/users/me) ----------------------------------------------------
export function demoProfile() {
  const u = MockData.user();
  return { email: 'demo@cyclingtrainer.app', age: u.age, weight_kg: u.weight_kg, goal: u.goal, w_prime_total: 21500 };
}

// --- Goals ------------------------------------------------------------------
export function demoGoals() {
  return [
    {
      id: 'demo-goal-1',
      goal_type: 'ftp_target',
      title: 'Reach 300W FTP',
      target_date: daysAgoDate(-56),
      target_ftp: 300,
      target_distance_km: null,
      target_event_name: null,
      current_progress: 72,
      status: 'active',
      created_at: daysAgoDate(70),
    },
    {
      id: 'demo-goal-2',
      goal_type: 'event',
      title: 'Gran Fondo — September',
      target_date: daysAgoDate(-92),
      target_ftp: null,
      target_distance_km: null,
      target_event_name: 'Gran Fondo',
      current_progress: 41,
      status: 'active',
      created_at: daysAgoDate(40),
    },
  ];
}

export function demoGoalInsight(goalId: string) {
  const onTrack = goalId === 'demo-goal-1';
  return {
    on_track: onTrack,
    message: onTrack
      ? "You're on track — at 72% with steady FTP gains, 300W is within reach by your target date."
      : 'A little behind pace. Increasing your long-ride volume over the next month will close the gap.',
    critical_action: onTrack ? 'Keep your threshold sessions consistent.' : 'Add one extra endurance ride per week.',
    estimated_achievement_date: onTrack ? daysAgoDate(-49) : daysAgoDate(-110),
    progress: onTrack ? 72 : 41,
  };
}

// --- Sync status ------------------------------------------------------------
export function demoSyncStatus() {
  return {
    connected: true,
    sync_status: 'idle',
    sync_error: null,
    last_sync_at: new Date().toISOString(),
    total_rides: 50,
    progress_percent: 100,
    initial_sync_completed: true,
  };
}

// --- Coach chat -------------------------------------------------------------
export function demoCoachMessage(text: string) {
  const lower = text.toLowerCase();
  let message =
    "Your form is trending up and recovery looks solid — a great time to push your threshold work. Keep the long Zone 2 ride this weekend.";
  let intent = 'info';
  let suggested: { label: string; screen: string } | null = null;
  if (/tired|fatigue|sore|rest/.test(lower)) {
    message = "Thanks for flagging that. Let's keep today easy — an easy spin or a rest day, and prioritize sleep tonight. We'll pick the intensity back up once you're fresh.";
    intent = 'injury';
    suggested = { label: 'See recovery', screen: 'Recovery' };
  } else if (/tomorrow|workout|plan/.test(lower)) {
    message = "Tomorrow is a threshold session: 3×12 min at 95–100% FTP (≈285W) with 5 min easy between. It's your key workout this week — fuel well beforehand.";
    intent = 'plan_change';
    suggested = { label: 'View plan', screen: 'TrainingPlan' };
  } else if (/form|how am i|progress/.test(lower)) {
    message = "You're in good form — CTL is climbing steadily and your 20-min power is up about 4% this month. Stay consistent and the gains will keep coming.";
  }
  return { message, intent, suggested_action: suggested, remaining: null };
}
