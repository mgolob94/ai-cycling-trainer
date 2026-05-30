const { supabaseAdmin } = require('../db/supabase');
const metrics = require('./metrics');
const ftpService = require('./ftp');

const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

function isoDaysAgo(n, from = new Date()) {
  const d = new Date(from);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function diffDays(isoA, isoB) {
  return Math.round(
    (new Date(`${isoA}T00:00:00Z`) - new Date(`${isoB}T00:00:00Z`)) / 86400000
  );
}

/** Classify a ride by intensity factor (NP or avg power / FTP). */
function classifyIntensity(ride, ftp) {
  const power = ride.normalized_power || ride.avg_power_w;
  if (!power || !ftp) return null;
  const intensityFactor = power / ftp;
  if (intensityFactor < 0.75) return 'low';
  if (intensityFactor >= 0.9) return 'high';
  return 'mid';
}

function intensityFractions(rides, ftp, sinceIso) {
  const inWindow = rides.filter(
    (r) => r.ride_date && r.ride_date >= sinceIso && classifyIntensity(r, ftp)
  );
  if (!inWindow.length) return null;
  const low = inWindow.filter((r) => classifyIntensity(r, ftp) === 'low').length;
  const high = inWindow.filter((r) => classifyIntensity(r, ftp) === 'high').length;
  return { count: inWindow.length, lowPct: low / inWindow.length, highPct: high / inWindow.length };
}

/** Longest streak of consecutive days ending at the most recent ride. */
function consecutiveStreak(rideDates) {
  if (!rideDates.length) return 0;
  const dates = [...new Set(rideDates)].sort();
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i -= 1) {
    if (diffDays(dates[i], dates[i - 1]) === 1) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Pure rule engine. Returns the top 3 recommendations sorted by priority.
 * ctx: { weeklyMetrics[], rides[], ftp: {ftp_watts, watts_per_kg, test_date}|null, todayIso }
 */
function buildRecommendations({ weeklyMetrics = [], rides = [], ftp = null, todayIso }) {
  const today = todayIso || new Date().toISOString().slice(0, 10);
  const recs = [];

  const latest = weeklyMetrics[weeklyMetrics.length - 1];
  const prev = weeklyMetrics[weeklyMetrics.length - 2];

  // 1. Recovery -----------------------------------------------------------
  if (latest && latest.tsb != null && latest.tsb < -25) {
    recs.push({
      type: 'recovery',
      message: 'Priporočamo lahek obnovitveni dan ali dan počitka',
      priority: 'high',
      action_cta: 'Načrtuj počitek',
    });
  }
  if (latest && prev && prev.atl > 0 && (latest.atl - prev.atl) / prev.atl > 0.15) {
    recs.push({
      type: 'injury_risk',
      message: 'Previsok skok v obremenitvi — tveganje poškodbe',
      priority: 'high',
      action_cta: 'Zmanjšaj obremenitev',
    });
  }

  // 2. Intensity ----------------------------------------------------------
  const last3w = intensityFractions(rides, ftp?.ftp_watts, isoDaysAgo(21, new Date(today)));
  if (last3w && last3w.lowPct > 0.8) {
    recs.push({
      type: 'intensity',
      message: 'Dodaj 1 intervalni trening na teden',
      priority: 'medium',
      action_cta: 'Dodaj intervale',
    });
  }
  const last2w = intensityFractions(rides, ftp?.ftp_watts, isoDaysAgo(14, new Date(today)));
  if (last2w && last2w.highPct > 0.4) {
    recs.push({
      type: 'intensity',
      message: 'Preveč intenzivnih treningov — zmanjšaj na 2x/teden',
      priority: 'high',
      action_cta: 'Zmanjšaj intenzivnost',
    });
  }

  // 3. FTP ----------------------------------------------------------------
  if (!ftp || !ftp.test_date || diffDays(today, ftp.test_date) > 42) {
    recs.push({
      type: 'ftp',
      message: 'Čas je za FTP test — morda si napredoval!',
      priority: 'medium',
      action_cta: 'Opravi FTP test',
    });
  }
  if (ftp?.watts_per_kg != null && ftp.watts_per_kg < 2.5) {
    recs.push({
      type: 'focus',
      message: 'Osredotoči se na bazično vzdržljivost za dvig forme',
      priority: 'low',
      action_cta: 'Bazični trening',
    });
  } else if (ftp?.watts_per_kg != null && ftp.watts_per_kg > 4.0) {
    recs.push({
      type: 'focus',
      message: 'Dodaj VO2max treninge za nadaljnji napredek',
      priority: 'low',
      action_cta: 'VO2max trening',
    });
  }

  // 4. Volume -------------------------------------------------------------
  if (latest && weeklyMetrics.length >= 5) {
    const prior4 = weeklyMetrics.slice(-5, -1);
    const avg = prior4.reduce((s, w) => s + (w.total_distance_km || 0), 0) / prior4.length;
    if (avg > 0 && latest.total_distance_km > avg * 1.2) {
      const delta = Math.round(latest.total_distance_km - avg);
      recs.push({
        type: 'volume',
        message: `Prevelik skok v volumnu (+${delta} km). Drži se pravila 10%.`,
        priority: 'medium',
        action_cta: 'Umiri tempo',
      });
    }
  }

  // 5. Streak / consistency ----------------------------------------------
  const rideDates = rides.map((r) => r.ride_date).filter(Boolean);
  if (rideDates.length) {
    const lastRide = [...rideDates].sort()[rideDates.length - 1];
    const daysSince = diffDays(today, lastRide);
    if (daysSince > 10) {
      recs.push({
        type: 'consistency',
        message: 'Dobrodošel nazaj! Začni počasi z lahkim treningom.',
        priority: 'medium',
        action_cta: 'Lahek trening',
      });
    } else if (consecutiveStreak(rideDates) >= 7) {
      recs.push({
        type: 'consistency',
        message: 'Odličen niz! Ne pozabi na počitek.',
        priority: 'low',
        action_cta: 'Načrtuj počitek',
      });
    }
  }

  // Sort by priority (stable) and take the top 3.
  return recs
    .map((r, i) => ({ r, i }))
    .sort((a, b) => PRIORITY_WEIGHT[b.r.priority] - PRIORITY_WEIGHT[a.r.priority] || a.i - b.i)
    .slice(0, 3)
    .map(({ r }) => r);
}

/** Gather a user's data and produce their current recommendations. */
async function generateRecommendations(userId) {
  const [{ data: rides }, { data: profile }, ftp] = await Promise.all([
    supabaseAdmin.from('rides').select('*').eq('user_id', userId).order('ride_date', { ascending: true }),
    supabaseAdmin.from('users').select('age').eq('id', userId).single(),
    ftpService.getLatest(userId),
  ]);

  const weeklyMetrics = metrics.computeWeeklyMetrics(rides || [], {
    ftp: ftp?.ftp_watts,
    thresholdHr: metrics.estimateThresholdHr(profile?.age),
  });

  return buildRecommendations({ weeklyMetrics, rides: rides || [], ftp });
}

module.exports = { buildRecommendations, generateRecommendations, classifyIntensity };
