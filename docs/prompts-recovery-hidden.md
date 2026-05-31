# Claude Code Prompts — Recovery (Backend Only, UI Hidden)

Recovery se IMPLEMENTIRA v celoti v ozadju.
UI zaslon je SKRIT dokler niso odobreni Garmin/Whoop API-ji.
Apple Health se implementira ker ne potrebuje posebne API odobritve.

Pravilo: vse recovery funkcije tečejo tiho. Plan se prilagodi brez da
uporabnik vidi recovery zaslon ali razlago. Ko pridejo API-ji, samo
odkrijemo zaslon — vse ostalo je že zgrajeno.

---

## 1. DATABASE (enako kot prej — implementiraj vse)

```
Read CLAUDE.md. Create Supabase migration for recovery tables.
These tables are implemented now but the UI screen is hidden until
Garmin/Whoop APIs are approved.

Tables to create (full implementation):

hrv_readings:
- id (uuid, PK)
- user_id (uuid, FK → users)
- recorded_at (timestamp)
- hrv_ms (float)
- resting_hr (integer)
- source (text) — 'apple_health' | 'manual'   ← NO garmin/whoop yet
- raw_data (jsonb)

sleep_sessions:
- id (uuid, PK)
- user_id (uuid, FK → users)
- date (date)
- sleep_start (timestamp)
- sleep_end (timestamp)
- duration_min (integer)
- deep_min (integer)
- rem_min (integer)
- light_min (integer)
- awake_min (integer)
- sleep_score (integer)
- source (text) — 'apple_health' | 'manual'
- raw_data (jsonb)

recovery_scores:
- id (uuid, PK)
- user_id (uuid, FK → users)
- date (date) UNIQUE per user
- recovery_score (integer) — 0–100
- hrv_score (integer)
- sleep_score (integer)
- training_load_score (integer)
- subjective_feeling (integer) — 1–5 from morning check-in
- check_in_source (text) — 'apple_health' | 'manual'
- readiness_label (text)
- recommendation (text)
- created_at (timestamp)

source_connections:
- id (uuid, PK)
- user_id (uuid, FK → users)
- source (text) — 'apple_health'  ← only this for now
- is_connected (boolean)
- last_sync_at (timestamp)

Enable RLS on all tables.
```

---

## 2. APPLE HEALTH — IMPLEMENTIRAJ ZDAJ

```
Read CLAUDE.md. Implement Apple Health integration in
mobile/src/services/appleHealth.ts using expo-health.

Apple Health does NOT require special API approval —
only needs HealthKit entitlement in the Expo build config.

1. Add to app.json:
   "infoPlist": {
     "NSHealthShareUsageDescription": "Kōda uses your health data to calculate your daily recovery score and adapt your training plan.",
     "NSHealthUpdateUsageDescription": "Kōda needs access to your health data."
   }
   "entitlements": {
     "com.apple.developer.healthkit": true
   }

2. Request permissions (read only):
   - HKQuantityTypeIdentifierHeartRateVariabilitySDNN
   - HKQuantityTypeIdentifierRestingHeartRate
   - HKCategoryTypeIdentifierSleepAnalysis

3. fetchHRVData(days = 30): Promise<HRVReading[]>
   - Fetch SDNN samples, convert to RMSSD (multiply by 0.85)
   - Map to hrv_readings schema
   - source = 'apple_health'

4. fetchSleepData(days = 30): Promise<SleepSession[]>
   - Fetch and merge sleep segments by night
   - Calculate deep %, REM %, total duration
   - source = 'apple_health'

5. fetchRestingHR(days = 30): Promise<number[]>

6. syncToDatabase(userId): Promise<SyncResult>
   - Upsert all data to Supabase
   - Update source_connections.last_sync_at
   - Runs silently in background — no UI feedback needed

7. isAvailable(): Promise<boolean>
   - Returns false on Android or simulator
   - Returns true on physical iOS device

IMPORTANT: All of this runs silently.
No UI prompt asking user to connect Apple Health.
Request permissions once during onboarding (quietly, after Strava connect).
If user denies → app works fine, just no HRV/sleep data.
```

---

## 3. RECOVERY SCORE — IZRAČUN (teče vsak dan)

```
Read CLAUDE.md. Create backend/src/services/recoveryScore.js.
This runs daily at 06:00 via Supabase Edge Function cron.
No UI — pure background calculation.

Function: calculateRecoveryScore(userId, date)

Algorithm (same as before):
  hrv_score (40%): today's HRV vs 30-day baseline
  sleep_score (35%): duration + quality from Apple Health or manual
  training_load_score (25%): yesterday's ATL (from performance_metrics)

If no HRV data: use subjective_feeling from morning check-in as proxy
  1 (wrecked) → hrv_score = 15
  2 (tired)   → hrv_score = 35
  3 (ok)      → hrv_score = 55
  4 (good)    → hrv_score = 75
  5 (great)   → hrv_score = 90

If no sleep data: use 60 (neutral)
If no check-in AND no HRV: use 50 (neutral) — plan doesn't change

Labels:
  85–100: 'optimal'
  70–84:  'good'
  50–69:  'moderate'
  30–49:  'poor'
  0–29:   'rest'

Save to recovery_scores table.
After saving: call planAdaptation.adjustForRecovery(userId) silently.

NO push notification about recovery score (UI is hidden).
Only use the score internally to adjust the training plan.
```

---

## 4. MORNING CHECK-IN — IMPLEMENTIRAJ, MINIMALNO PRIKAŽI

```
Read CLAUDE.md. Implement morning check-in as a minimal,
non-intrusive element on the Dashboard screen.

NOT a full recovery screen. Just a tiny check-in widget.

Show a subtle card at the bottom of Dashboard (NOT top, NOT full screen):

  ┌─────────────────────────────────────────┐
  │  How are you feeling this morning?      │
  │  😴  😕  😐  😊  ⚡                    │
  └─────────────────────────────────────────┘

Show ONLY if:
  - Time is between 05:00 and 11:00
  - No recovery score for today yet
  - User has not dismissed it today

On emoji tap:
  - Save to recovery_scores.subjective_feeling
  - Card disappears instantly (no confirmation)
  - Recovery score calculates in background
  - Plan may quietly adjust — no explanation shown

"Skip" option: small X on the card (no tap = no data = neutral score)

Style: subtle, small card. slate-100 bg in light mode, #1A1A1A in dark.
Not green, not attention-grabbing. It should feel like a small habit,
not a feature being promoted.

DO NOT mention "recovery score", "HRV", or any metric in this UI.
Just: "How are you feeling this morning?"
```

---

## 5. PLAN ADAPTATION — SILENT RECOVERY INTEGRATION

```
Read CLAUDE.md. Update backend/src/services/adaptiveTraining.js
to silently factor recovery into the training plan.

When generateWeeklyPlan() runs every Monday:
  1. Get today's recovery score (or last available)
  2. Pass to AI prompt as context:
     "Recovery context: {score}/100 ({label})"
  3. AI adjusts plan without explaining why to the user
     — lower intensity days if recovery is poor
     — maintain plan if recovery is good

When user submits morning check-in during the week:
  1. Recalculate recovery score
  2. Check if today's planned workout needs adjustment:
     - score < 40: replace today's workout with recovery ride
     - score 40-60: reduce intensity by one zone
     - score > 60: no change
  3. Update today's workout in training_plans silently
  4. No notification, no explanation — plan just updates

The user sees their plan change without knowing why.
Later when recovery screen is revealed, it all makes sense.

DO NOT add any copy like "adjusted for recovery" to workout cards yet.
Just update the workout. The explanation comes with the recovery screen.
```

---

## 6. APPLE HEALTH — ONBOARDING (SILENT)

```
Read CLAUDE.md. Add silent Apple Health permission request to onboarding.

After Strava OAuth completes (step 3 of onboarding), add:

  // Check if HealthKit is available (iOS physical device only)
  const available = await appleHealth.isAvailable()
  
  if (available) {
    // Request permissions silently — no dedicated onboarding screen
    // Just request in background after Strava connect succeeds
    await appleHealth.requestPermissions()
    // iOS will show system dialog automatically
    // If user approves → start syncing
    // If user denies → continue normally, no error
    await appleHealth.syncToDatabase(userId)
  }

NO dedicated "Connect Apple Health" screen in onboarding.
NO mention of recovery or health tracking in v1.0 onboarding.
The system dialog from iOS is enough explanation.

When Recovery screen is revealed later:
  - Show Apple Health connection status
  - Allow user to manage permissions
  - Explain what data was being collected
```

---

## 7. FEATURE FLAG — RECOVERY SCREEN

```
Read CLAUDE.md. Create a feature flag system to control
which screens are visible without code changes.

Create backend/src/config/featureFlags.js:

const FEATURE_FLAGS = {
  recovery_screen:     false,  // ← HIDDEN until Garmin/Whoop approved
  coach_chat:          false,  // ← v1.1
  monthly_review:      false,  // ← v1.1
  power_duration_curve: false, // ← v1.1
  nutrition_screen:    true,
  strength_in_plan:    true,
  morning_checkin:     true,
  apple_health_sync:   true,
}

Export getFlag(key: string): boolean

Store flags in Supabase table feature_flags (key, enabled, updated_at)
so they can be toggled without app redeployment.

In mobile app: create mobile/src/config/featureFlags.ts
  - Fetches flags from GET /config/flags on app start
  - Caches in AsyncStorage for offline use
  - Provides useFeatureFlag(key) hook

Usage in navigation:
  // Tab bar — only show Recovery tab when flag is enabled
  {getFlag('recovery_screen') && (
    <Tab.Screen name="Recovery" component={RecoveryScreen} />
  )}

Usage in settings:
  // Show Apple Health settings only if sync is enabled
  {getFlag('apple_health_sync') && <AppleHealthRow />}

When Garmin/Whoop APIs are approved:
  1. Set recovery_screen: true in Supabase
  2. Recovery tab appears for all users automatically
  3. All data that was collected silently is now visible
  4. Users see months of history from day one — magic moment
```
