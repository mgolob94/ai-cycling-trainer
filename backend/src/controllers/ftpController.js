const ftp = require('../services/ftp');
const ftpTest = require('../services/ftpTest');
const strava = require('../services/strava');
const metrics = require('../services/metrics');
const { supabaseAdmin } = require('../db/supabase');
const { invalidateCache } = require('../services/aiCache');

/**
 * A new FTP shifts every ride's TSS, so the full-history PMC must be recomputed.
 * Fire-and-forget so the FTP response returns immediately.
 */
function recalcMetricsInBackground(userId) {
  setImmediate(() => {
    metrics
      .calculateFullHistory(userId)
      .catch((e) => console.warn('[ftp] full-history recalc skipped:', e.message));
  });
}

/**
 * POST /ftp/calculate — estimate FTP from the user's last 90 days of rides,
 * persist it to ftp_tests, and return the result.
 */
async function calculate(req, res, next) {
  try {
    // Estimated from existing rides, so re-running with unchanged data yields
    // the same value — only record a new test row when it actually changes.
    const result = await ftp.recalculateForUser(req.user.id, { recordOnlyIfChanged: true });

    if (!result) {
      return res.status(422).json({
        success: false,
        data: null,
        error:
          'Not enough power data to estimate FTP — need at least one ride of 20+ minutes with power in the last 90 days.',
      });
    }

    recalcMetricsInBackground(req.user.id);
    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ftp/latest — the user's most recent FTP test. */
async function latest(req, res, next) {
  try {
    const data = await ftp.getLatest(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ftp/history — all of the user's FTP tests, oldest first. */
async function history(req, res, next) {
  try {
    const data = await ftp.getHistory(req.user.id);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** GET /ftp/test/protocols — guided test protocol definitions. */
function testProtocols(req, res) {
  res.json({ success: true, data: ftpTest.PROTOCOLS, error: null });
}

/**
 * POST /ftp/test/analyze — analyze a completed FTP test ride.
 * Body: { test_type: "ramp"|"20min", strava_activity_id }
 */
async function testAnalyze(req, res, next) {
  try {
    const { test_type: testType, strava_activity_id: stravaActivityId } = req.body || {};
    if (!['ramp', '20min'].includes(testType)) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'test_type must be "ramp" or "20min"' });
    }
    if (!stravaActivityId) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing strava_activity_id' });
    }

    let stream;
    try {
      stream = await strava.fetchActivityPowerStream(req.user.id, stravaActivityId);
    } catch {
      return res
        .status(422)
        .json({ success: false, data: null, error: 'Could not fetch power data from Strava.' });
    }
    if (!stream || !stream.length) {
      return res
        .status(422)
        .json({ success: false, data: null, error: 'This activity has no power data.' });
    }

    const result = ftpTest.analyze(testType, stream);
    const newFtp = result.ftp;

    const prior = await ftp.getLatest(req.user.id);
    const previousFtp = prior?.ftp_watts ?? null;

    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('weight_kg')
      .eq('id', req.user.id)
      .single();
    const weightKg = profile?.weight_kg ?? null;
    const wPerKg = weightKg ? Math.round((newFtp / weightKg) * 100) / 100 : null;

    const changeWatts = previousFtp != null ? newFtp - previousFtp : null;
    const changePercent =
      previousFtp ? Math.round(((newFtp - previousFtp) / previousFtp) * 1000) / 10 : null;

    // Date the test by the underlying ride, falling back to today.
    const { data: ride } = await supabaseAdmin
      .from('rides')
      .select('ride_date')
      .eq('user_id', req.user.id)
      .eq('strava_id', stravaActivityId)
      .maybeSingle();
    const testDate = ride?.ride_date ?? new Date().toISOString().slice(0, 10);

    const { error: insertError } = await supabaseAdmin.from('ftp_tests').insert({
      user_id: req.user.id,
      ftp_watts: newFtp,
      weight_kg: weightKg,
      watts_per_kg: wPerKg,
      test_date: testDate,
      notes: `${testType === 'ramp' ? 'Ramp test' : '20-min test'} (quality: ${result.test_quality})`,
    });
    if (insertError) throw insertError;

    // A new FTP changes every analysis — invalidate all caches for this user.
    try {
      await invalidateCache(req.user.id, null, null, 'ftp_test');
    } catch (e) {
      console.warn('[ftp test] cache invalidation skipped:', e.message);
    }

    recalcMetricsInBackground(req.user.id);

    res.json({
      success: true,
      data: {
        new_ftp: newFtp,
        previous_ftp: previousFtp,
        change_watts: changeWatts,
        change_percent: changePercent,
        w_per_kg: wPerKg,
        test_quality: result.test_quality,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { calculate, latest, history, testProtocols, testAnalyze };
