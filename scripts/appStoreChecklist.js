#!/usr/bin/env node
/**
 * App Store readiness checklist — scans the project and reports on submission
 * requirements. Read-only; never modifies anything.
 *
 *   node scripts/appStoreChecklist.js
 *
 * Output: ✅ pass / ❌ blocker / ⚠️ should-fix per item, grouped by severity,
 * each with a one-line fix hint. Exits non-zero if any REQUIRED item fails.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MOBILE = path.join(ROOT, 'mobile');
const p = (...s) => path.join(ROOT, ...s);

const C = { reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m', yellow: '\x1b[33m', dim: '\x1b[2m', bold: '\x1b[1m' };

let blockers = 0;
const line = (icon, text, hint) => {
  console.log(`  ${icon} ${text}${hint ? `\n      ${C.dim}↳ ${hint}${C.reset}` : ''}`);
};
const ok = (t) => line('✅', t);
const bad = (t, hint) => {
  blockers += 1;
  line(`${C.red}❌${C.reset}`, t, hint);
};
const warn = (t, hint) => line(`${C.yellow}⚠️${C.reset}`, t, hint);

// --- file helpers ---------------------------------------------------------
const exists = (f) => {
  try {
    return fs.existsSync(f);
  } catch {
    return false;
  }
};
const read = (f) => {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return null;
  }
};
const readJSON = (f) => {
  const raw = read(f);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/** Recursively collect source files under a dir (skips node_modules/.expo). */
function walk(dir, exts, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.expo' || e.name === 'dist') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, exts, out);
    else if (exts.some((x) => e.name.endsWith(x))) out.push(full);
  }
  return out;
}

/** PNG width/height from the IHDR chunk (bytes 16–24), or null. */
function pngSize(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(24);
    fs.readSync(fd, buf, 0, 24, 0);
    fs.closeSync(fd);
    if (buf.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  } catch {
    return null;
  }
}

const app = readJSON(p('mobile', 'app.json'))?.expo ?? null;

// ==========================================================================
console.log(`\n${C.bold}App Store Readiness — Kōda${C.reset}\n`);

console.log(`${C.bold}REQUIRED${C.reset} ${C.dim}(blocks submission)${C.reset}`);
if (!app) {
  bad('mobile/app.json not found or invalid JSON', 'Fix app.json so it parses.');
} else {
  app.name ? ok(`app name: "${app.name}"`) : bad('app.json missing name', 'Add expo.name');
  app.version ? ok(`version: ${app.version}`) : bad('app.json missing version', 'Add expo.version');
  app.ios?.bundleIdentifier
    ? ok(`iOS bundleIdentifier: ${app.ios.bundleIdentifier}`)
    : bad('missing ios.bundleIdentifier', 'Add expo.ios.bundleIdentifier');
  app.android?.package ? ok(`Android package: ${app.android.package}`) : bad('missing android.package', 'Add expo.android.package');

  const privacy = app.privacyPolicyUrl || app.extra?.privacyPolicyUrl;
  privacy ? ok('privacy policy URL set') : bad('no privacy policy URL', 'Add expo.extra.privacyPolicyUrl (App Store requires one).');

  const desc = app.description || '';
  desc.length >= 80 ? ok(`description (${desc.length} chars)`) : bad(`description too short (${desc.length}/80)`, 'Add expo.description ≥ 80 chars.');

  const health = app.ios?.infoPlist?.NSHealthShareUsageDescription;
  const entitled = app.ios?.entitlements?.['com.apple.developer.healthkit'];
  health && entitled
    ? ok('HealthKit entitlement + usage description present')
    : bad('HealthKit config incomplete', 'Need ios.entitlements healthkit + NSHealthShareUsageDescription.');
}

// console.log of sensitive data in backend
const SENSITIVE = /(token|password|secret|api[_-]?key|access_token|service_role)/i;
const backendFiles = walk(p('backend', 'src'), ['.js']);
const sensitiveLogs = [];
for (const f of backendFiles) {
  (read(f) || '').split('\n').forEach((ln, i) => {
    if (/console\.log/.test(ln) && SENSITIVE.test(ln)) sensitiveLogs.push(`${path.relative(ROOT, f)}:${i + 1}`);
  });
}
sensitiveLogs.length === 0
  ? ok('no console.log with sensitive keywords in backend/src')
  : warn(`${sensitiveLogs.length} console.log may log sensitive data`, sensitiveLogs.slice(0, 5).join(', '));

// .env in .gitignore
const gi = read(p('.gitignore')) || '';
/(^|\n)\.env\b/.test(gi) || gi.includes('.env')
  ? ok('.env is gitignored')
  : bad('.env not in .gitignore', 'Add .env to .gitignore.');

// hardcoded keys in source
const KEY_PATTERNS = [/sk-[A-Za-z0-9]{20,}/, /service_role/, /AIza[0-9A-Za-z_-]{30,}/];
const srcFiles = [...walk(p('mobile', 'src'), ['.ts', '.tsx']), ...backendFiles];
const keyHits = [];
for (const f of srcFiles) {
  const txt = read(f) || '';
  if (KEY_PATTERNS.some((re) => re.test(txt))) keyHits.push(path.relative(ROOT, f));
}
keyHits.length === 0
  ? ok('no obvious hardcoded API keys in source')
  : bad(`possible hardcoded keys in ${keyHits.length} file(s)`, keyHits.slice(0, 5).join(', '));

// ==========================================================================
console.log(`\n${C.bold}IMPORTANT${C.reset} ${C.dim}(should fix before submission)${C.reset}`);

const iconCandidates = ['assets/icon.png', 'assets/images/icon.png'].map((r) => path.join(MOBILE, r));
const iconFile = iconCandidates.find(exists);
if (!iconFile) warn('app icon not found', 'Add mobile/assets/icon.png (1024×1024).');
else {
  const sz = pngSize(iconFile);
  sz && sz.w >= 1024 && sz.h >= 1024
    ? ok(`app icon ${sz.w}×${sz.h}`)
    : warn(`app icon ${sz ? `${sz.w}×${sz.h}` : 'size unknown'}`, 'App Store icon should be 1024×1024.');
}

app?.splash || (app?.plugins || []).some((pl) => (Array.isArray(pl) ? pl[0] : pl) === 'expo-splash-screen')
  ? ok('splash screen configured')
  : warn('no splash screen', 'Add expo.splash in app.json.');

const eas = readJSON(p('mobile', 'eas.json'));
eas?.build?.production
  ? ok('eas.json has a production profile')
  : warn('eas.json production profile missing', 'Run `eas build:configure` and add a production profile.');

const envFiles = ['.env.production', '.env', 'backend/.env', '.env.example'].map((r) => p(r));
const envText = envFiles.map(read).filter(Boolean).join('\n');
/MOCK_EXTERNAL_APIS\s*=\s*false/.test(envText)
  ? ok('MOCK_EXTERNAL_APIS=false present in an env file')
  : warn('MOCK_EXTERNAL_APIS not set to false', 'Ensure production env has MOCK_EXTERNAL_APIS=false.');

const hasErrorBoundary = walk(p('mobile', 'src'), ['.tsx']).some((f) => /ErrorBoundary/.test(read(f) || ''));
hasErrorBoundary ? ok('ErrorBoundary referenced in mobile/src') : warn('no ErrorBoundary found', 'Wrap main screens in an error boundary.');

const flagsFile = read(p('backend', 'src', 'config', 'featureFlags.js'));
flagsFile ? ok('feature flags config present (verify production values manually)') : warn('feature flags config not found', 'Confirm flags are set for production.');

// ==========================================================================
console.log(`\n${C.bold}RECOMMENDED${C.reset}`);
app?.extra?.termsUrl || app?.termsOfServiceUrl ? ok('terms of service URL set') : warn('no terms of service URL', 'Add expo.extra.termsUrl.');
app?.extra?.supportEmail ? ok('support email set') : warn('no support email', 'Add expo.extra.supportEmail.');
exists(p('docs', 'screenshots')) ? ok('docs/screenshots/ exists') : warn('no screenshots folder', 'Add docs/screenshots/ with store screenshots.');
exists(p('docs', 'app-store-keywords.txt')) ? ok('keywords file exists') : warn('no keywords file', 'Add docs/app-store-keywords.txt.');

// ==========================================================================
console.log('');
if (blockers > 0) {
  console.log(`${C.red}${C.bold}${blockers} blocker(s) must be fixed before submission.${C.reset}\n`);
  process.exit(1);
}
console.log(`${C.green}${C.bold}No blockers. Address ⚠️ items before submitting.${C.reset}\n`);
