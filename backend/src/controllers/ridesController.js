const { supabaseAdmin } = require('../db/supabase');

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

module.exports = { listRides, getLatestRide };
