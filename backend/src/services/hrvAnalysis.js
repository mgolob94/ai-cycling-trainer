const { supabaseAdmin } = require('../db/supabase');

// HRV trend analysis (rule-based, no AI tokens). All HRV values are RMSSD in ms.

// ---------------------------------------------------------------------------
// date helpers (UTC, Monday-based weeks to align with performance_metrics)
// ---------------------------------------------------------------------------
function mondayOf(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const day = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + ((day === 0 ? -6 : 1) - day));
  return d;
}
function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
function addDays(d, n) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

/** Least-squares slope of y over index 0..n-1. */
function slope(ys) {
  const n = ys.length;
  if (n < 2) return 0;
  const xs = ys.map((_, i) => i);
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

/** Pearson correlation between two equal-length series. */
function pearson(xs, ys) {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i += 1) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const den = Math.sqrt(dx * dy);
  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// 1. Baseline
// ---------------------------------------------------------------------------
/** Rolling 30-day average HRV (ms), excluding values > 2 SD from the mean. */
async function getHRVBaseline(userId, days = 30) {
  const since = isoDate(addDays(new Date(), -days));
  const { data } = await supabaseAdmin
    .from('hrv_readings')
    .select('hrv_ms')
    .eq('user_id', userId)
    .gte('recorded_at', `${since}T00:00:00Z`)
    .not('hrv_ms', 'is', null);

  const vals = (data || []).map((r) => r.hrv_ms).filter((v) => v != null);
  if (!vals.length) return null;

  const m = mean(vals);
  const sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2)));
  const kept = sd > 0 ? vals.filter((v) => Math.abs(v - m) <= 2 * sd) : vals;
  return Math.round(mean(kept.length ? kept : vals) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Weekly bucketing shared by the trend + correlation views
// ---------------------------------------------------------------------------
async function weeklyBuckets(userId, weeks) {
  const thisMonday = mondayOf(new Date());
  const starts = [];
  for (let i = weeks - 1; i >= 0; i -= 1) starts.push(isoDate(addDays(thisMonday, -7 * i)));
  const oldest = starts[0];

  const [{ data: hrv }, { data: recov }, { data: pm }] = await Promise.all([
    supabaseAdmin
      .from('hrv_readings')
      .select('recorded_at, hrv_ms')
      .eq('user_id', userId)
      .gte('recorded_at', `${oldest}T00:00:00Z`)
      .not('hrv_ms', 'is', null)
      .gt('hrv_ms', 0)
      .lte('hrv_ms', 250), // physiological sanity bound — drop garbage RMSSD values
    supabaseAdmin
      .from('recovery_scores')
      .select('date, recovery_score')
      .eq('user_id', userId)
      .gte('date', oldest),
    supabaseAdmin
      .from('performance_metrics')
      .select('week_start, tss')
      .eq('user_id', userId)
      .gte('week_start', oldest),
  ]);

  const tssByWeek = new Map((pm || []).map((r) => [r.week_start, r.tss]));

  return starts.map((week) => {
    const weekEnd = isoDate(addDays(new Date(`${week}T00:00:00Z`), 6));
    const hrvVals = (hrv || [])
      .filter((r) => r.recorded_at.slice(0, 10) >= week && r.recorded_at.slice(0, 10) <= weekEnd)
      .map((r) => r.hrv_ms);
    const recovVals = (recov || [])
      .filter((r) => r.date >= week && r.date <= weekEnd && r.recovery_score != null)
      .map((r) => r.recovery_score);
    return {
      week,
      avg_hrv: hrvVals.length ? Math.round(mean(hrvVals) * 10) / 10 : null,
      recovery_avg: recovVals.length ? Math.round(mean(recovVals)) : null,
      tss: tssByWeek.get(week) ?? null,
    };
  });
}

// ---------------------------------------------------------------------------
// 2. Trend
// ---------------------------------------------------------------------------
const INTERPRETATION = {
  improving: 'HRV is rising — your body is adapting well to training.',
  stable: 'HRV is stable — a good balance between training and recovery.',
  declining: 'HRV is falling — you may be training too hard or not sleeping enough.',
};

async function getHRVTrend(userId, weeks = 8) {
  const [baseline, buckets] = await Promise.all([getHRVBaseline(userId, 30), weeklyBuckets(userId, weeks)]);

  const withHrv = buckets.filter((b) => b.avg_hrv != null);
  const currentWeekAvg = withHrv.length ? withHrv[withHrv.length - 1].avg_hrv : null;
  const firstAvg = withHrv.length ? withHrv[0].avg_hrv : null;

  const trendPercent =
    firstAvg && currentWeekAvg != null ? Math.round(((currentWeekAvg - firstAvg) / firstAvg) * 1000) / 10 : 0;
  const s = slope(withHrv.map((b) => b.avg_hrv));

  let trend = 'stable';
  if (trendPercent > 5 && s > 0) trend = 'improving';
  else if (trendPercent < -5 && s < 0) trend = 'declining';

  return {
    baseline_ms: baseline,
    current_week_avg: currentWeekAvg,
    trend,
    trend_percent: trendPercent,
    interpretation: INTERPRETATION[trend],
    weeks: buckets.map((b) => ({ week: b.week, avg_hrv: b.avg_hrv, recovery_avg: b.recovery_avg })),
  };
}

// ---------------------------------------------------------------------------
// 3. HRV vs training load
// ---------------------------------------------------------------------------
async function getHRVvsTrainingLoad(userId, weeks = 8) {
  const buckets = await weeklyBuckets(userId, weeks);
  const paired = buckets.filter((b) => b.avg_hrv != null && b.tss != null);

  const hrvSeries = paired.map((b) => b.avg_hrv);
  const tssSeries = paired.map((b) => b.tss);
  const correlation = Math.round(pearson(tssSeries, hrvSeries) * 100) / 100;

  const tssRising = slope(tssSeries) > 0;
  const hrvFalling = slope(hrvSeries) < 0;

  let pattern = 'neutral';
  let interpretation = 'Not enough of a training-load change to assess the pattern.';
  if (paired.length >= 3) {
    if (tssRising && hrvFalling) {
      pattern = 'warning';
      interpretation = 'HRV is dropping while training load rises — a possible overreaching signal. Add recovery.';
    } else if (tssRising) {
      pattern = 'healthy';
      interpretation = 'HRV is holding up as training load rises — you are adapting well.';
    }
  }

  return {
    correlation,
    pattern,
    interpretation,
    weeks: buckets.map((b) => ({ week: b.week, avg_hrv: b.avg_hrv, tss: b.tss })),
  };
}

module.exports = { getHRVBaseline, getHRVTrend, getHRVvsTrainingLoad };
