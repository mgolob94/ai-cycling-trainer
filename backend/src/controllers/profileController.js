const pdc = require('../services/pdc');
const ftpService = require('../services/ftp');
const riderProfile = require('../services/riderProfile');
const { supabaseAdmin } = require('../db/supabase');

/** GET /profile/rider-type — rider classification + strengths/weaknesses + radar. */
async function riderType(req, res, next) {
  try {
    const [allTimePdc, ftp, { data: profile }] = await Promise.all([
      pdc.getAllTime(req.user.id),
      ftpService.getLatest(req.user.id),
      supabaseAdmin.from('users').select('goal').eq('id', req.user.id).single(),
    ]);

    const result = riderProfile.analyze(allTimePdc, ftp?.ftp_watts ?? null, profile?.goal ?? null);
    res.json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { riderType };
