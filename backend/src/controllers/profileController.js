const pdc = require('../services/pdc');
const ftpService = require('../services/ftp');
const riderProfile = require('../services/riderProfile');
const { supabaseAdmin } = require('../db/supabase');

// Rider type reflects the current season: a rolling 12-month power profile.
const SEASON_DAYS = 365;

/** GET /profile/rider-type — rider classification + strengths/weaknesses + radar. */
async function riderType(req, res, next) {
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - SEASON_DAYS);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const [seasonPdc, ftp, { data: profile }] = await Promise.all([
      pdc.computeFromRides(req.user.id, cutoffStr),
      ftpService.getLatest(req.user.id),
      supabaseAdmin.from('users').select('goal').eq('id', req.user.id).single(),
    ]);

    // Fall back to the all-time curve if there's no power data this season.
    const curve = seasonPdc.length ? seasonPdc : await pdc.getAllTime(req.user.id);

    const result = riderProfile.analyze(curve, ftp?.ftp_watts ?? null, profile?.goal ?? null);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { riderType };
