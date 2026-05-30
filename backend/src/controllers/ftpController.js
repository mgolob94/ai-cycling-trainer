const { supabaseAdmin } = require('../db/supabase');
const ftp = require('../services/ftp');

/**
 * POST /ftp/calculate — estimate FTP from the user's last 90 days of rides,
 * persist it to ftp_tests, and return the result.
 */
async function calculate(req, res, next) {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: rides, error: ridesError } = await supabaseAdmin
      .from('rides')
      .select('*')
      .eq('user_id', req.user.id)
      .gte('ride_date', ninetyDaysAgo.toISOString().slice(0, 10))
      .not('avg_power_w', 'is', null);

    if (ridesError) throw ridesError;

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('weight_kg')
      .eq('id', req.user.id)
      .single();

    if (profileError) throw profileError;

    const result = await ftp.calculateAndStore(
      req.user.id,
      rides || [],
      profile?.weight_kg ?? null
    );

    if (!result) {
      return res.status(422).json({
        success: false,
        data: null,
        error:
          'Not enough power data to estimate FTP — need at least one ride of 20+ minutes with power in the last 90 days.',
      });
    }

    res.status(201).json({ success: true, data: result, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { calculate };
