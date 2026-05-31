const { supabaseAdmin } = require('../db/supabase');
const strava = require('../services/strava');
const ftpService = require('../services/ftp');
const metrics = require('../services/metrics');
const wprime = require('../services/wprime');
const aiCoach = require('../services/aiCoach');
const rideFeedback = require('../services/rideFeedback');

/** Downsample an array to at most `target` evenly-spaced points. */
function downsample(arr, target = 120) {
  if (arr.length <= target) return arr;
  const step = Math.ceil(arr.length / target);
  const out = [];
  for (let i = 0; i < arr.length; i += step) out.push(arr[i]);
  return out;
}

/** GET /api/rides — recent rides for the user, newest first. */
async function listRides(req, res, next) {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);

    const { data, error } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', req.user.id)
      .order('ride_date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /api/rides/latest — the user's most recent ride, or null. */
async function getLatestRide(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', req.user.id)
      .order('ride_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /rides/:strava_id/analyze — full single-ride analysis: fetch the power
 * stream, compute NP/xPower/VI/EF + power curve + W' profile + zone
 * distribution, get an AI breakdown, store it on the ride, and return it all.
 */
async function analyze(req, res, next) {
  try {
    const stravaId = req.params.strava_id;

    const { data: ride, error: rideError } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', req.user.id)
      .eq('strava_id', stravaId)
      .maybeSingle();
    if (rideError) throw rideError;
    if (!ride) {
      return res.status(404).json({ success: false, data: null, error: 'Ride not found' });
    }

    const latestFtp = await ftpService.getLatest(req.user.id);
    if (!latestFtp?.ftp_watts) {
      return res
        .status(422)
        .json({ success: false, data: null, error: 'No FTP on record — calculate your FTP first.' });
    }

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
    const wPrimeTotal = profile?.w_prime_total ?? wprime.DEFAULT_W_PRIME;

    let stream;
    try {
      stream = await strava.fetchActivityPowerStream(req.user.id, stravaId);
    } catch {
      return res
        .status(422)
        .json({ success: false, data: null, error: 'Could not fetch power data from Strava.' });
    }
    if (!stream || !stream.length) {
      return res
        .status(422)
        .json({ success: false, data: null, error: 'This ride has no power data.' });
    }

    const power = metrics.analyzeRidePower(stream, ride.avg_heart_rate);
    const zones = metrics.powerZoneDistribution(stream, latestFtp.ftp_watts);
    const wp = wprime.computeWPrimeBalance(stream, latestFtp.ftp_watts, wPrimeTotal);

    const aiAnalysis = await aiCoach.analyzeRide({
      userProfile: profile || {},
      ftpHistory: latestFtp ? [latestFtp] : [],
      ride,
      power,
      zones,
      wprime: wp,
    });

    // Persist computed power metrics + the AI analysis on the ride.
    await supabaseAdmin
      .from('rides')
      .update({
        normalized_power: power.normalized_power,
        xpower: power.xpower,
        variability_index: power.variability_index,
        efficiency_factor: power.efficiency_factor,
        power_curve: power.power_curve,
        ai_analysis: aiAnalysis,
      })
      .eq('id', ride.id);

    res.json({
      success: true,
      data: {
        ride: {
          strava_id: ride.strava_id,
          distance_km: ride.distance_km,
          duration_sec: ride.duration_sec,
          avg_power_w: ride.avg_power_w,
          avg_heart_rate: ride.avg_heart_rate,
          elevation_m: ride.elevation_m,
          ride_date: ride.ride_date,
        },
        normalized_power: power.normalized_power,
        xpower: power.xpower,
        variability_index: power.variability_index,
        efficiency_factor: power.efficiency_factor,
        power_curve: power.power_curve,
        zones,
        wprime: {
          min_w_prime_balance: wp.min_w_prime_balance,
          w_prime_depletion_percent: wp.w_prime_depletion_percent,
          match_count: wp.match_count,
          w_prime_total: wPrimeTotal,
          balance_stream: downsample(wp.w_prime_balance_stream, 120),
        },
        ai_analysis: aiAnalysis,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /rides/:strava_id/feedback — record the post-workout survey and return
 * the coach's brief post-ride feedback.
 * Body: { completion_status, perceived_effort, post_feeling, workout_date,
 *         planned_tss, actual_tss }
 */
async function feedback(req, res, next) {
  try {
    const stravaId = req.params.strava_id;
    const result = await rideFeedback.recordFeedback(req.user.id, stravaId, req.body || {});
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /rides/:strava_id/feedback — stored survey + coach feedback, or null. */
async function getFeedback(req, res, next) {
  try {
    const data = await rideFeedback.getFeedback(req.user.id, req.params.strava_id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRides, getLatestRide, analyze, feedback, getFeedback };
