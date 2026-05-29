const { supabaseAdmin } = require('../db/supabase');

const EDITABLE_FIELDS = ['age', 'weight_kg', 'fitness_level', 'goal'];

async function getProfile(req, res, next) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const updates = {};
    for (const field of EDITABLE_FIELDS) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

/** POST /api/users/push-token — register/refresh this device's push token. */
async function registerPushToken(req, res, next) {
  try {
    const { token, platform } = req.body;
    if (!token) {
      return res
        .status(400)
        .json({ success: false, data: null, error: 'Missing push token' });
    }

    // Upsert on token so the same device re-registering (or moving accounts)
    // updates the owning user rather than duplicating.
    const { error } = await supabaseAdmin.from('push_tokens').upsert(
      { user_id: req.user.id, token, platform: platform ?? null },
      { onConflict: 'token' }
    );

    if (error) throw error;
    res.json({ success: true, data: { registered: true }, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { getProfile, updateProfile, registerPushToken };
