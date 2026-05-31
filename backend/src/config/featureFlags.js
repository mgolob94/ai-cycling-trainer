const { supabaseAdmin } = require('../db/supabase');

// Server-controlled feature visibility. Defaults here; overridable per-key in
// the Supabase `feature_flags` table (toggled without an app redeploy).
const DEFAULTS = {
  recovery_screen: false, // hidden until Garmin/Whoop APIs are approved
  coach_chat: false, // v1.1 (note: kept visible in-app by product decision)
  monthly_review: false, // v1.1
  power_duration_curve: false, // v1.1
  nutrition_screen: true,
  strength_in_plan: true,
  morning_checkin: true,
  apple_health_sync: true,
};

let cache = null;
let cachedAt = 0;
const TTL_MS = 60_000;

/** All flags (DB overrides merged onto defaults), cached for 60s. */
async function getAllFlags() {
  if (cache && Date.now() - cachedAt < TTL_MS) return cache;
  const merged = { ...DEFAULTS };
  try {
    const { data } = await supabaseAdmin.from('feature_flags').select('key, enabled');
    for (const r of data || []) merged[r.key] = r.enabled;
  } catch {
    // fall back to defaults
  }
  cache = merged;
  cachedAt = Date.now();
  return merged;
}

async function getFlag(key) {
  const flags = await getAllFlags();
  return flags[key] ?? false;
}

module.exports = { DEFAULTS, getAllFlags, getFlag };
