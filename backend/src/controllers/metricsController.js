const metrics = require('../services/metrics');
const ftp = require('../services/ftp');
const strava = require('../services/strava');
const wprime = require('../services/wprime');
const { supabaseAdmin } = require('../db/supabase');

/**
 * GET /metrics/weekly — recompute weekly training-load metrics from the user's
 * ride history, persist them, and return the most recent 12 weeks.
 */
async function weekly(req, res, next) {
  try {
    const weeks = await metrics.calculateAndStore(req.user.id);
    res.json({ success: true, data: weeks.slice(-12), error: null });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /metrics/wprime — W' (anaerobic capacity) analysis for one activity.
 * Needs the user's FTP and the activity's power stream from Strava.
 */
async function wprimeAnalysis(req, res, next) {
  try {
    const stravaActivityId = req.body?.strava_activity_id;
    if (!stravaActivityId) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing strava_activity_id' });
    }

    const latestFtp = await ftp.getLatest(req.user.id);
    if (!latestFtp?.ftp_watts) {
      return res.status(422).json({
        success: false,
        data: null,
        error: 'No FTP on record — calculate your FTP first.',
      });
    }

    // w_prime_total lives on the user profile (default 20000). Select '*' so a
    // pre-migration profile (without the column) just falls back to the default.
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();
    const wPrimeTotal = profile?.w_prime_total ?? wprime.DEFAULT_W_PRIME;

    let stream;
    try {
      stream = await strava.fetchActivityPowerStream(req.user.id, stravaActivityId);
    } catch {
      return res.status(422).json({
        success: false,
        data: null,
        error: 'Could not fetch power data for this activity from Strava.',
      });
    }
    if (!stream || !stream.length) {
      return res.status(422).json({
        success: false,
        data: null,
        error: 'This activity has no power data.',
      });
    }

    const analysis = wprime.computeWPrimeBalance(stream, latestFtp.ftp_watts, wPrimeTotal);

    res.json({
      success: true,
      data: { ...analysis, ftp: latestFtp.ftp_watts, w_prime_total: wPrimeTotal },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /metrics/recalculate — recompute CTL/ATL/TSB from the user's full ride
 * history. Runs in the background (can take a few seconds) and returns 202.
 */
async function recalculate(req, res, next) {
  try {
    const userId = req.user.id;
    setImmediate(() => {
      metrics
        .calculateFullHistory(userId)
        .catch((e) => console.warn('[metrics recalculate]', e.message));
    });
    res.status(202).json({
      success: true,
      data: { started: true, message: 'Full-history recalculation started' },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { weekly, wprimeAnalysis, recalculate };
