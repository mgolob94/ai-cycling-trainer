/* eslint-disable no-console */
// Remove all data for the mock test user (reset to a clean state).
//   node scripts/clearMockData.js   (or: npm --prefix backend run seed:clear)
// Pass --delete-user to also remove the auth user.

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });

const { supabaseAdmin } = require(path.join(BACKEND, 'src', 'db', 'supabase'));

const TEST_EMAIL = 'test@cycling.app';
const USER_TABLES = [
  'rides',
  'hrv_readings',
  'sleep_sessions',
  'recovery_scores',
  'performance_metrics',
  'ftp_tests',
  'training_plans',
  'personal_records',
  'power_duration_bests',
  'source_connections',
];

async function main() {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = data.users.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    console.log(`No test user (${TEST_EMAIL}) found — nothing to clear.`);
    return;
  }

  for (const table of USER_TABLES) {
    const { error } = await supabaseAdmin.from(table).delete().eq('user_id', user.id);
    console.log(error ? `✗ ${table}: ${error.message}` : `✓ cleared ${table}`);
  }

  if (process.argv.includes('--delete-user')) {
    await supabaseAdmin.auth.admin.deleteUser(user.id);
    console.log(`✓ deleted auth user ${TEST_EMAIL}`);
  }
  console.log('Done.');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Clear failed:', e.message);
    process.exit(1);
  });
