# Claude Code Prompts — Mock Data Sistem za Razvoj

Cilj: razvijaj vse funkcije brez fizičnega iPhone-a ali zunanjih API-jev.
Mock data se samodejno zamenja z realnimi podatki ko je integracija dostopna.

---

## 1. MOCK DATA SERVICE — CORE

```
Read CLAUDE.md. Create mobile/src/services/mockData.ts — a comprehensive mock
data service that simulates all external data sources during development.

The service must:
- Be active ONLY when: __DEV__ === true AND no real data source is connected
- Be completely transparent — all other services call the same interface
- Generate realistic data (not flat/constant values — use variation and trends)

Implement these mock generators:

1. generateMockHRV(days: number = 30): HRVReading[]
   - Baseline: 55ms RMSSD (realistic amateur cyclist)
   - Add daily variation: ±8ms random noise
   - Add weekly pattern: slightly lower on Mon/Tue (post-weekend fatigue)
   - Add trend: gradual improvement over 30 days (+5ms total)
   - Occasional dip: 2–3 random days with -15ms (stress/bad sleep simulation)
   - Return array sorted by date DESC

2. generateMockSleep(days: number = 30): SleepSession[]
   - Average duration: 7h 20min with ±45min variation
   - Deep sleep: 18–22% of total
   - REM: 20–25% of total
   - Weekends: 30–45min longer than weekdays
   - Occasional poor night: 1–2x per week, 5h 30min with low deep %
   - Calculate sleep_score from duration + quality

3. generateMockRecoveryScores(days: number = 30): RecoveryScore[]
   - Derived from mock HRV + mock sleep + existing TSS data
   - Use same algorithm as real recoveryScore.js service
   - If no TSS data available: use random realistic load pattern

4. generateMockRides(count: number = 50): Ride[]
   - Mix of ride types: Z2 endurance (60%), threshold (25%), intervals (15%)
   - Distance: 30–120km with realistic distribution
   - Power: FTP 260W base with ±15% variation by zone
   - Duration: proportional to distance
   - Spread over last 6 months with realistic training frequency (4–5x/week)
   - Include power streams for NP/TSS calculation

5. generateMockFTPHistory(): FTPTest[]
   - 3 FTP tests over 6 months
   - Start: 245W → 265W → 287W (realistic progression)
   - Dates: spaced 8–10 weeks apart

6. generateMockUser(): UserProfile
   - Name: "Test Kolesar"
   - Age: 34, weight: 72kg
   - FTP: 287W (3.99 W/kg)
   - Goal: endurance
   - Level: intermediate

Export a single object:
  export const MockData = {
    hrv: generateMockHRV,
    sleep: generateMockSleep,
    recovery: generateMockRecoveryScores,
    rides: generateMockRides,
    ftpHistory: generateMockFTPHistory,
    user: generateMockUser,
  }
```

---

## 2. DEV MODE WRAPPER

```
Read CLAUDE.md. Create mobile/src/services/dataSource.ts — a universal wrapper
that automatically switches between mock and real data.

This is the ONLY file other services should import from.
Never import from appleHealth.ts, garmin.ts, or whoop.ts directly in screens or hooks.

Pattern:

import { MockData } from './mockData'
import { appleHealth } from './appleHealth'
import { isDevice } from 'expo-device'

const USE_MOCK = __DEV__ && !isDevice

export const DataSource = {

  async getHRV(days: number): Promise<HRVReading[]> {
    if (USE_MOCK) {
      console.log('[MOCK] Returning mock HRV data')
      return MockData.hrv(days)
    }
    // Check which real source is connected
    const connection = await getActiveHRVSource()
    if (connection === 'apple_health') return appleHealth.fetchHRVData(days)
    if (connection === 'garmin') return garmin.fetchHRVData(days)
    if (connection === 'whoop') return whoop.fetchHRVData(days)
    return [] // no source connected
  },

  async getSleep(days: number): Promise<SleepSession[]> {
    if (USE_MOCK) return MockData.sleep(days)
    // same pattern as above
  },

  async getRecoveryScore(date: string): Promise<RecoveryScore | null> {
    if (USE_MOCK) {
      const scores = MockData.recovery(1)
      return scores[0] || null
    }
    // fetch from Supabase (already calculated by backend)
  },

  async getRides(limit: number): Promise<Ride[]> {
    if (USE_MOCK) return MockData.rides(limit)
    // fetch from Supabase rides table
  },

  isMockMode(): boolean {
    return USE_MOCK
  }
}

Add a visual indicator: when USE_MOCK is true, show a small yellow "DEMO" badge
in the top-left corner of every screen (only in __DEV__ mode).
This prevents confusion between mock and real data during development.
```

---

## 3. MOCK SUPABASE SEED SCRIPT

```
Read CLAUDE.md. Create scripts/seedMockData.js — a script that populates the
Supabase database with realistic mock data for a test user.

Run with: node scripts/seedMockData.js

What it does:
1. Creates a test user in Supabase Auth (email: test@cycling.app, password: Test1234!)
2. Inserts user profile (age 34, weight 72, FTP 287, goal: endurance)
3. Generates and inserts 6 months of rides (use MockData generators)
4. Calculates and inserts TSS/NP for each ride
5. Runs full CTL/ATL/TSB history calculation
6. Generates and inserts 30 days of HRV readings
7. Generates and inserts 30 days of sleep sessions
8. Calculates and inserts 30 days of recovery scores
9. Generates 3 FTP test results
10. Generates a training plan for current week

Output:
  ✓ Test user created: test@cycling.app
  ✓ 187 rides inserted (6 months)
  ✓ CTL: 74, ATL: 62, TSB: +12
  ✓ 30 HRV readings inserted (baseline: 55ms)
  ✓ 30 sleep sessions inserted (avg: 7h 22min)
  ✓ 30 recovery scores calculated
  ✓ Training plan for this week ready
  
  Login: test@cycling.app / Test1234!

Also create scripts/clearMockData.js that removes all data for the test user
(useful for resetting to clean state during development).

Add to package.json scripts:
  "seed": "node scripts/seedMockData.js",
  "seed:clear": "node scripts/clearMockData.js"
```

---

## 4. MOCK API SERVER (za backend development)

```
Read CLAUDE.md. Create backend/src/mock/mockServer.js — a lightweight mock
server that simulates all external APIs (Strava, Garmin, Whoop) during development.

Only active when NODE_ENV=development AND MOCK_EXTERNAL_APIS=true in .env.

Intercept these API calls using axios-mock-adapter or nock:

1. Strava API mocks:
   GET https://www.strava.com/api/v3/athlete
   → returns mock athlete { id: 12345, firstname: "Test", lastname: "Kolesar" }

   GET https://www.strava.com/api/v3/athlete/activities
   → returns array of mock activities (use MockData.rides generator adapted for Strava format)
   → supports ?page and ?per_page query params

   GET https://www.strava.com/api/v3/activities/:id/streams
   → returns mock power stream (array of 1-second power values)

2. Garmin API mocks:
   GET https://healthapi.garmin.com/wellness-api/rest/dailies
   → returns mock daily wellness data

   GET https://healthapi.garmin.com/wellness-api/rest/sleeps
   → returns mock sleep data

3. Whoop API mocks:
   GET https://api.prod.whoop.com/developer/v1/recovery
   → returns mock recovery data with hrv_rmssd_milli values

4. OpenAI API mock:
   POST https://api.openai.com/v1/chat/completions
   → returns pre-written mock training plan JSON
   → returns pre-written mock weekly analysis text
   → add 500ms artificial delay (simulate real API latency)
   → track call count: log "[MOCK OpenAI] Call #N — saved ~$0.02"

Add to .env.example:
   MOCK_EXTERNAL_APIS=true   # set to false in production

Log all intercepted calls with [MOCK API] prefix so they are easy to spot.
```

---

## 5. DEMO MODE ZA ONBOARDING

```
Read CLAUDE.md. Create a "Demo mode" feature that lets new users explore the app
with realistic mock data before connecting any real accounts.

Add to mobile/src/screens/WelcomeScreen.tsx a secondary CTA:

Primary button:   "Ustvari račun" (main flow)
Secondary button: "Oglej si demo" (smaller, ghost button)

Demo mode flow:
1. Tap "Oglej si demo"
2. No signup required — create anonymous local session
3. Load MockData for all screens
4. Show persistent demo banner at top of every screen:
   "DEMO NAČIN — Podatki so simulirani  [Ustvari pravi račun →]"
   Banner: amber-50 bg, amber-600 text, not dismissible

Demo mode limitations (show these in a modal before entering demo):
   ✓ Vse funkcije vidne
   ✓ Realistični podatki
   ✗ Podatki se ne shranijo
   ✗ Ni sinhronizacije s Stravo
   ✗ Treningi niso personalizirani

Demo data uses fixed seed so it looks the same every time:
   - "Marcel Kolesar", FTP 287W, CTL 74, form "Optimalna"
   - Current week: Sweet spot in intervals trening
   - Recovery score: 78 "Dobra pripravljenost"
   - Last ride: 68km, NP 241W, AI score 8.2/10

Demo mode ends when:
   - User taps "Ustvari pravi račun" banner
   - App is closed and reopened (ephemeral — no persistence)

This lets people experience the full UI before committing to signup.
Great for App Store screenshots too.
```

---

## 6. DEVELOPMENT TOOLS SCREEN

```
Read CLAUDE.md. Create mobile/src/screens/DevToolsScreen.tsx —
a hidden developer screen only accessible in __DEV__ mode.

Access: shake device → dev menu → "Dev Tools"
OR: on Profile screen, tap app version number 5 times quickly

SECTIONS:

1. Data Source:
   Toggle: "Mock Mode ON/OFF"
   Current: "Using: Mock Data (simulator)"
   Button: "Re-seed mock data" → calls seed endpoint

2. Mock Data Controls:
   "Simulate bad recovery day" → sets today's mock recovery to 25
   "Simulate new PR" → adds a fake personal record
   "Simulate new Strava activity" → triggers webhook simulation
   "Fast-forward week" → shifts all dates by 7 days

3. API Status:
   Shows connection status for each service:
   ○ Strava (not connected in dev)
   ○ Apple Health (not available in simulator)
   ○ Garmin (not connected)
   ○ Whoop (not connected)
   ● Supabase (connected) — shows URL

4. Cache Controls:
   "Clear all AI cache" → calls DELETE /cache/invalidate for all types
   "View cache stats" → shows hit rate and tokens saved
   "Trigger recovery score calc" → calls POST /recovery/calculate

5. Navigation shortcuts:
   Direct buttons to every screen (skips normal navigation flow)
   Useful for testing specific screens quickly

6. Logs:
   Last 20 console.log entries visible in-app
   Filter by: [MOCK] [CACHE] [SYNC] [API]
   Copy to clipboard button

Only render this screen in __DEV__ — add a guard:
   if (!__DEV__) return null
```

---

## 7. MOCK DATA VALIDACIJA

```
Read CLAUDE.md. Create scripts/validateMockData.js — a script that verifies
mock data is consistent and realistic.

Run with: npm run validate:mock

Checks:
1. HRV values are in realistic range (20–100ms RMSSD)
2. Sleep sessions sum correctly (deep + rem + light + awake = total)
3. CTL/ATL/TSB calculations match expected formulas
4. TSS values are positive and not unrealistically high (< 400 per day)
5. FTP progression is realistic (no more than 20W increase per 6 weeks)
6. Recovery scores are within 0–100
7. All rides have required fields (strava_id, user_id, ride_date, distance)
8. No duplicate strava_ids in ride data

Output:
  Validating mock data...
  ✓ HRV: 30 readings, range 38–71ms, baseline 55ms
  ✓ Sleep: 30 sessions, avg 7h 22min, min 5h 15min
  ✓ Rides: 187 activities, avg TSS 68, total CTL 74
  ✓ FTP: 245W → 265W → 287W (valid progression)
  ✓ Recovery: 30 scores, avg 71, range 28–94
  All checks passed ✓

Add to package.json:
  "validate:mock": "node scripts/validateMockData.js"

Run this as part of CI/CD pipeline to catch mock data issues early.
```
