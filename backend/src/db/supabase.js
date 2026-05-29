const { createClient } = require('@supabase/supabase-js');

const { SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY } = process.env;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '[supabase] SUPABASE_URL / SUPABASE_ANON_KEY not set — copy .env.example to .env and fill them in. Database calls will fail until then.'
  );
}

// Placeholders keep client construction from throwing when env is unset (e.g.
// first boot before .env exists). Real values come from the environment.
const url = SUPABASE_URL || 'http://localhost:54321';
const anonKey = SUPABASE_ANON_KEY || 'public-anon-key-placeholder';

// Anon client — respects Row Level Security, used for user-scoped requests.
const supabase = createClient(url, anonKey);

// Service-role client — bypasses RLS, used only for trusted server-side work
// (webhooks, background syncs). Never expose this to the client.
const supabaseAdmin = createClient(
  url,
  SUPABASE_SERVICE_ROLE_KEY || anonKey,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

module.exports = { supabase, supabaseAdmin };
