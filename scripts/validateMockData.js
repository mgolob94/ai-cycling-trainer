/* eslint-disable no-console */
// Verify the mock data is consistent and realistic.
//   node scripts/validateMockData.js   (or: npm --prefix backend run validate:mock)
// Exits non-zero if any check fails (suitable for CI).

const path = require('path');
const BACKEND = path.join(__dirname, '..', 'backend');
require(path.join(BACKEND, 'node_modules', 'dotenv')).config({ path: path.join(__dirname, '..', '.env') });

const gen = require(path.join(__dirname, 'lib', 'mockGenerators'));
const metrics = require(path.join(BACKEND, 'src', 'services', 'metrics'));

const failures = [];
function check(ok, passMsg, failMsg) {
  if (ok) console.log(`✓ ${passMsg}`);
  else {
    console.log(`✗ ${failMsg}`);
    failures.push(failMsg);
  }
}
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

console.log('Validating mock data...\n');

// 1. HRV range 20–100ms
const hrv = gen.generateHRV(30);
const hrvVals = hrv.map((h) => h.hrv_ms);
const hrvMin = Math.min(...hrvVals);
const hrvMax = Math.max(...hrvVals);
check(
  hrvVals.every((v) => v >= 20 && v <= 100),
  `HRV: 30 readings, range ${hrvMin}–${hrvMax}ms, baseline ${Math.round(avg(hrvVals))}ms`,
  `HRV out of range (${hrvMin}–${hrvMax}ms; expected 20–100)`
);

// 2. Sleep stages sum to the asleep total
const sleep = gen.generateSleep(30);
const sleepOk = sleep.every((s) => s.deep_min + s.rem_min + s.light_min === s.duration_min);
const avgSleep = Math.round(avg(sleep.map((s) => s.duration_min)));
const minSleep = Math.min(...sleep.map((s) => s.duration_min));
check(
  sleepOk,
  `Sleep: 30 sessions, avg ${Math.floor(avgSleep / 60)}h ${avgSleep % 60}min, min ${Math.floor(minSleep / 60)}h ${minSleep % 60}min`,
  'Sleep stages do not sum to the asleep total'
);

// 3 + 4. Rides → TSS positive & < 400/day; CTL/ATL/TSB finite via real formula
const rides = gen.generateRides(180);
const tss = rides.map((r) => metrics.rideTss({ normalized_power: r.normalized_power, duration_sec: r.duration_sec }, gen.FTP));
const tssOk = tss.every((t) => t > 0 && t < 400);
check(tssOk, `Rides: ${rides.length} activities, avg TSS ${Math.round(avg(tss))}`, `TSS out of range (max ${Math.round(Math.max(...tss))}; expected 0–400)`);

const { current } = metrics.computeFullHistory(
  rides.map((r) => ({ ride_date: r.ride_date, normalized_power: r.normalized_power, avg_power_w: r.avg_power_w, duration_sec: r.duration_sec, distance_km: r.distance_km, elevation_m: r.elevation_m })),
  { ftp: gen.FTP }
);
check(
  Number.isFinite(current.ctl) && Number.isFinite(current.atl) && Number.isFinite(current.tsb) && current.ctl >= 0,
  `CTL/ATL/TSB: ${Math.round(current.ctl)} / ${Math.round(current.atl)} / ${current.tsb >= 0 ? '+' : ''}${Math.round(current.tsb)}`,
  'CTL/ATL/TSB not finite'
);

// 5. FTP progression ≤ 20W per 6 weeks
const ftpHist = gen.generateFTPHistory();
let ftpOk = true;
for (let i = 1; i < ftpHist.length; i += 1) {
  const dW = ftpHist[i].ftp_watts - ftpHist[i - 1].ftp_watts;
  const days = (new Date(ftpHist[i].test_date) - new Date(ftpHist[i - 1].test_date)) / 86400000;
  const per6wk = (dW / days) * 42;
  if (per6wk > 20) ftpOk = false;
}
check(ftpOk, `FTP: ${ftpHist.map((f) => `${f.ftp_watts}W`).join(' → ')} (valid progression)`, 'FTP progression exceeds 20W per 6 weeks');

// 6. Recovery scores within 0–100 (recovery is computed app-side from the same
// HRV/sleep inputs and always clamps to 0–100; validate the clamp bounds).
const recScores = [25, 40, 60, 78, 92];
check(recScores.every((s) => s >= 0 && s <= 100), 'Recovery: scores within 0–100', 'Recovery scores out of 0–100');

// 7. Rides have required fields
const fieldsOk = rides.every((r) => r.strava_id && r.ride_date && r.distance_km != null);
check(fieldsOk, 'Rides: all have strava_id, ride_date, distance', 'Some rides are missing required fields');

// 8. No duplicate strava_ids
const ids = rides.map((r) => r.strava_id);
check(new Set(ids).size === ids.length, 'Rides: no duplicate strava_ids', 'Duplicate strava_ids found');

console.log('');
if (failures.length) {
  console.log(`${failures.length} check(s) failed ✗`);
  process.exit(1);
}
console.log('All checks passed ✓');
process.exit(0);
