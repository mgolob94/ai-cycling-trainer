# CLAUDE.md — Kōda

The AI cycling coach that grows with you.
Read this file before every task. Follow it precisely.

---

## DOCUMENTATION RULE (critical)

**After every task that changes the app, update this file.**

Specifically:
- New table added → update Database Schema
- New service/file created → update Project Structure
- New feature built → update Features section
- Schema changed → update the relevant table
- Feature flag changed → update Feature Flags section

If you skip this, the next task starts with wrong context.
At the end of every response, add: "📄 CLAUDE.md updated: [what changed]"
If nothing changed in the architecture: "📄 CLAUDE.md: no changes needed"

---

## Product

**Name:** Kōda
**Type:** B2C mobile app — AI cycling coach
**Platforms:** iOS + Android (React Native / Expo)
**Positioning:** The only cycling app that grows with you — beginner to serious amateur.

**Core loop:**
Connect Strava → AI builds full plan (training + nutrition + strength) → Train → Rate workout → Plan gets smarter

**Target users:** Recreational cyclists, fitness cyclists, serious amateurs. Not professionals.

**Differentiators:**
- Training + nutrition + strength in one plan
- Plain language for beginners, full data for advanced users (progressive disclosure)
- Recovery runs silently in background — plan adapts without explaining why
- Strava-inspired bold UI — numbers are heroes, not dashboards

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native (Expo) |
| Backend | Node.js (Express) |
| Database + Auth | Supabase (PostgreSQL) |
| AI | OpenAI GPT-4o |
| Activity data | Strava API (OAuth 2.0) |
| Health data | Apple HealthKit (expo-health, iOS only) |
| Deployment | Docker (self-hosted) |
| State (mobile) | Zustand |

---

## Design System

**Design language:** Athletic, editorial. Strava-inspired. Numbers are heroes.

**Fonts:**
- Display/numbers: `BarlowCondensed-Black` / `BarlowCondensed-Bold`
- Body/labels: `DMSans-Regular` / `DMSans-Medium`
- Data/mono: `JetBrainsMono-Regular`

**Colors (light / dark):**
- Background: `#F5F5F3` / `#0A0A09`
- Surface: `#FFFFFF` / `#141413`
- Surface alt: `#EFEFED` / `#1C1C1B`
- Text primary: `#111110` / `#F0EFEB`
- Text secondary: `#6B6B69` / `#787876`
- Green (primary): `#059669` / `#34D399`
- Achievement (PRs only): `#E8420A` / `#FF5733`
- Border: `#E8E8E6` / `#222221`

**Theme:** Auto (follows system) + manual toggle (light / dark)
**Token file:** `mobile/src/theme/tokens.ts`
**Typography file:** `mobile/src/theme/typography.ts`

**Rules:**
- No gradients, no heavy shadows, no decorative elements
- Achievement color ONLY for PRs, records, milestones — never as brand color
- All stat labels UPPERCASE, 10-11px, letterSpacing 0.7-0.8
- All big numbers in BarlowCondensed
- Dark background on activity detail and hero cards

**UI copy rules** (see also `docs/ui-copy.md`):
- "Optimal." not "Your form is currently optimal"
- "New record." not "You have achieved a new personal record"
- Numbers first, labels second, context third
- Uppercase labels, max 2 words

---

## Project Structure

```
/
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── onboarding/       # Welcome, SignUp, Profile, GoalSetup, CoachStyle, FirstSyncReveal
│   │   │   ├── MonthProgressScreen.tsx  # "4 weeks in" reveal (fires once)
│   │   │   ├── DashboardScreen.tsx
│   │   │   ├── PlanScreen.tsx
│   │   │   ├── RideDetailScreen.tsx
│   │   │   ├── ProgressScreen.tsx
│   │   │   ├── NutritionScreen.tsx
│   │   │   └── ProfileScreen.tsx
│   │   │   # RecoveryScreen.tsx — HIDDEN (feature flag: recovery_screen=false)
│   │   ├── components/
│   │   │   ├── ui/               # Card, Button, Badge, Text, StatCard, Divider
│   │   │   ├── metrics/          # TrainingScaleBar, MetricTooltip, ProgressiveStatCard,
│   │   │   │                     # MetricBadge, FirstEncounterHint
│   │   │   ├── workout/          # WorkoutCard, PostWorkoutSurvey, StrengthDetailSheet
│   │   │   ├── ride/             # EffortRating (stars/label/context from TSS)
│   │   │   ├── dashboard/        # MorningCheckIn, WeekSummaryCard
│   │   │   ├── sync/             # SyncInsightBanner (post-sync "what we learned")
│   │   │   └── plan/             # EventSetup, PhaseHeader, PlanReasoningCard
│   │   ├── hooks/                # useTrainingPlan, useSyncStatus, useFtp,
│   │   │                         # useWeeklyMetrics, useGoals, useNudges, …
│   │   ├── services/
│   │   │   ├── api.ts            # axios instance (+ demo adapter)
│   │   │   ├── dataSource.ts     # Universal wrapper (mock vs real)
│   │   │   ├── appleHealth.ts    # HealthKit integration
│   │   │   ├── demoAdapter.ts    # Demo-mode axios adapter
│   │   │   ├── demoData.ts       # Demo payloads
│   │   │   ├── notifications.ts  # Push notifications
│   │   │   ├── surveyTrigger.ts  # When to show the post-workout survey (AsyncStorage state)
│   │   │   ├── metricContext.ts  # Single source of truth: metric meanings + ranges
│   │   │   ├── tooltipTrigger.ts # One-time first-encounter hint state (AsyncStorage)
│   │   │   └── mockData.ts       # Dev mock data
│   │   ├── navigation/
│   │   │   ├── index.tsx         # NavigationContainer + theme
│   │   │   ├── AppStack.tsx      # Signed-in stack (pushed screens, header)
│   │   │   └── Tabs.tsx          # Bottom tabs (Recovery tab flag-gated)
│   │   ├── theme/
│   │   │   ├── tokens.ts         # Design tokens (light) + zoneColors + getTokens
│   │   │   ├── darkTokens.ts     # Dark overrides
│   │   │   ├── typography.ts     # Font families + variant presets
│   │   │   └── useTheme.tsx      # ThemeProvider + useTheme (auto/light/dark)
│   │   ├── config/
│   │   │   └── featureFlags.ts   # Flag store + useFeatureFlag hook
│   │   └── store/                # Zustand stores (auth, demo)
│   └── App.tsx
│
├── backend/
│   ├── src/
│   │   ├── routes/              # plans, coach, recovery, goals, config,
│   │   │                        # onboarding, strava, sync, metrics, ftp,
│   │   │                        # records, progress, workouts, notifications, …
│   │   ├── controllers/         # one per route group
│   │   ├── services/
│   │   │   ├── strava.js         # Strava API client
│   │   │   ├── metrics.js        # CTL/ATL/TSB
│   │   │   ├── ftp.js            # FTP from power data
│   │   │   ├── phaseEngine.js    # Phase determination (+ persists transitions)
│   │   │   ├── aiCoach.js        # Phase-aware plan (training + nutrition + strength)
│   │   │   ├── plans.js          # currentWeekStart + generateAndStorePlan → aiCoach
│   │   │   ├── adaptiveTraining.js # Silent recovery adaptation of today's workout
│   │   │   ├── recoveryScore.js  # Daily recovery score (subjective proxy)
│   │   │   ├── goalTracker.js    # Goal progress + AI insight
│   │   │   ├── rideFeedback.js   # Post-workout survey → coach feedback + progress signal + plan-adjust patterns
│   │   │   ├── dailyContext.js   # One-sentence "why today matters" for the Dashboard
│   │   │   ├── aiCache.js        # Universal AI cache service
│   │   │   └── notificationEngine.js  # Candidates + anti-spam + quiet hours
│   │   ├── middleware/auth.js    # JWT verification (HS256 + JWKS)
│   │   ├── mock/mockServer.js    # Mocks Strava/Garmin/Whoop/OpenAI in dev
│   │   └── config/
│   │       └── featureFlags.js   # Server-side feature flags + GET /config/flags
│   └── index.js
│
├── supabase/
│   ├── migrations/               # All SQL migrations in order
│   └── functions/
│       ├── daily-recovery/       # Runs 06:00 daily
│       └── notification-scheduler/ # Runs every 15min
│
├── scripts/
│   ├── seedMockData.js
│   ├── clearMockData.js
│   ├── validateMockData.js
│   └── appStoreChecklist.js      # Scans project for App Store submission readiness
│
├── docs/                         # All planning documents
│   ├── ui-copy.md                # ← ALL UI text lives here
│   ├── mvp-scope-v2.md
│   ├── prompts-*.md              # Feature prompts
│   └── ...
│
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                     # This file
```

---

## Database Schema

### users
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| email | text | Unique |
| age | integer | |
| weight_kg | float | |
| fitness_level | text | beginner / intermediate / advanced |
| goal | text | endurance / speed / weight loss / event |
| knowledge_level | text | beginner / intermediate / advanced (UI disclosure level) |
| coach_style | text | motivator / scientist / minimalist |
| current_phase | text | base / build / peak / recovery / taper |
| phase_started_at | date | |
| target_event_name | text | nullable |
| target_event_date | date | nullable |
| available_days_per_week | integer | 2–6 |
| preferred_long_ride_day | text | saturday / sunday |
| onboarding_completed | boolean | default false; set true after final onboarding step |
| dietary_notes | text | allergies, preferences |
| equipment_available | text[] | none / resistance_band / dumbbells |
| w_prime_total | integer | default 20000 (joules) |
| subscription_plan | text | free / basic / pro |
| ai_refreshes_used_this_month | integer | default 0 |
| ai_refreshes_reset_at | timestamp | |
| created_at | timestamp | |

### strava_connections
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| access_token | text | Encrypted |
| refresh_token | text | Encrypted |
| expires_at | timestamp | |
| last_sync_at | timestamp | |
| last_activity_sync_at | timestamp | |
| total_activities_synced | integer | |
| initial_sync_completed | boolean | |
| sync_status | text | idle / syncing / error / completed |

### rides
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| strava_id | text | Unique |
| distance_km | float | |
| duration_sec | integer | |
| avg_power_w | float | |
| normalized_power_w | float | NP calculated |
| avg_heart_rate | float | |
| elevation_m | float | |
| ride_date | date | |
| tss | float | Training Stress Score |
| variability_index | float | NP / avg power |
| efficiency_factor | float | NP / avg HR |
| power_curve | jsonb | Best power at standard durations |
| is_processed | boolean | metrics calculated |
| synced_at | timestamp | |

### training_plans
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| week_start | date | Monday |
| phase | text | base / build / peak / recovery / taper |
| phase_week | integer | |
| phase_total_weeks | integer | |
| tss_target | integer | |
| week_theme | text | |
| coach_intro | text | AI generated |
| workouts | jsonb | Array of workout objects |
| plan_json | jsonb | Full plan object — workouts + `nutrition` + `strength_sessions` + phase fields |
| reasoning | jsonb | Why this week looks like this (headline, bullets, key_workout, what_to_expect) |
| adapted_workout | jsonb | Recovery-adjusted version |
| adaptation_reason | text | Plain-English note for the "Plan updated · Here's why" banner (cleared on dismiss) |
| completion_pct | integer | Filled end of week |
| tss_achieved | integer | From Strava |
| cache_key | text | week_{YYYY-WW} |
| is_cached | boolean | served from AI cache |
| generated_at | timestamp | |

> **Unified plan:** there are NO separate `nutrition_plans` / `strength_plans`
> tables. Training + nutrition + strength are produced by a single
> `aiCoach.generateWeeklyPlan()` call and stored in `training_plans.plan_json`
> (`plan_json.nutrition` = weekly fueling guide; `plan_json.strength_sessions`
> = 2 off-bike sessions). There is no separate season plan either — phases live
> on `training_plans` and `phase_history`.

### phase_history
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| phase | text | base / build / peak / recovery / taper |
| started_at | date | |
| ended_at | date | nullable |
| reason | text | automatic / event_driven / manual |

### goals
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| goal_type | text | ftp_target / event / consistency / distance / fitness |
| title | text | |
| target_date | date | |
| target_ftp | integer | |
| target_distance_km | real | |
| target_event_name | text | |
| current_progress | integer | 0–100 |
| status | text | active / completed / abandoned |

### performance_metrics
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| week_start | date | |
| tss | float | |
| atl | float | Fatigue |
| ctl | float | Fitness |
| tsb | float | Form |
| total_distance_km | float | |
| ride_count | integer | |

### ftp_tests
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| ftp_watts | integer | |
| weight_kg | float | |
| watts_per_kg | float | |
| test_date | date | |

### personal_records
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| record_type | text | 5min_power / 20min_power / longest_ride / etc |
| value | float | |
| unit | text | watts / km / min |
| achieved_date | date | |

### ai_analysis_cache
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| analysis_type | text | weekly_summary / ride_analysis / etc |
| cache_key | text | |
| content_json | jsonb | |
| tokens_used | integer | |
| expires_at | timestamp | |
| is_valid | boolean | |

### workout_feedback
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| strava_activity_id | text | links to rides.strava_id; UNIQUE per user (one feedback per ride) |
| workout_date | date | |
| planned_workout_type | text | from the day's plan_json workout |
| completion_status | text | completed / partial / skipped |
| perceived_effort | integer | 1–4 (too easy / about right / hard / too much) |
| post_feeling | integer | 1–3 (fresh / normal / tired) |
| planned_tss | real | |
| actual_tss | real | |
| coach_feedback | text | AI-generated post-ride note, cached |
| coach_feedback_generated_at | timestamp | |
| progress_signal | text | One positive, data-driven observation from the ride (or null) |
| created_at | timestamp | |

> The post-workout survey writes here (the coach's learning loop). Patterns from
> the last 10 entries feed `buildCoachSystemPrompt`; deterministic rules
> (too-hard / too-easy / low-completion) drive next week's plan adjustment.

### recovery_scores ← HIDDEN (data collected, UI not shown)
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| date | date | Unique per user |
| recovery_score | integer | 0–100 |
| hrv_score | integer | |
| sleep_score | integer | |
| training_load_score | integer | |
| subjective_feeling | integer | 1–5 (morning check-in) |
| check_in_source | text | apple_health / manual |
| readiness_label | text | |

### hrv_readings ← HIDDEN
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| recorded_at | timestamp | |
| hrv_ms | float | |
| source | text | apple_health / manual |

### sleep_sessions ← HIDDEN
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| user_id | uuid | FK → users |
| date | date | |
| duration_min | integer | |
| sleep_score | integer | |
| source | text | apple_health / manual |

### feature_flags
| Column | Type | Notes |
|---|---|---|
| key | text | PK |
| enabled | boolean | |
| updated_at | timestamp | |

---

## Feature Flags

Managed in Supabase `feature_flags` table. Toggle without redeployment.

| Flag | Default | Notes |
|---|---|---|
| `recovery_screen` | `false` | Hidden until Garmin/Whoop APIs approved |
| `coach_chat` | `false` | v1.1 |
| `monthly_review` | `false` | v1.1 |
| `power_duration_curve` | `false` | v1.1 |
| `nutrition_screen` | `true` | v1.0 |
| `strength_in_plan` | `true` | v1.0 |
| `morning_checkin` | `true` | v1.0 |
| `apple_health_sync` | `true` | v1.0 (iOS only) |

---

## AI System

**Model:** OpenAI GPT-4o
**Cache:** All AI outputs cached in `ai_analysis_cache` table

Cache TTLs (`ai_analysis_cache.analysis_type`):
- `weekly_plan`: 168h (training + nutrition + strength — one entry)
- `weekly_summary`: 168h
- `ride_analysis`: permanent
- `ride_feedback`: permanent (8760h — post-ride survey feedback never changes)
- `monthly_reveal`: permanent (8760h — the "4 weeks in" snapshot)
- `sync_insight`: permanent (8760h — per-ride post-sync one-liner)
- `recommendations`: 48h
- `monthly_review`: 720h
- `goal_insight`: 168h
- `hrv_trend`: 48h

**Plan generation (one call, one entry):**
1. `phaseEngine.determinePhase(userId)` — sets phase from CTL/consistency or event date
2. `aiCoach.generateWeeklyPlan(userId, weekStart)` — produces workouts + `nutrition`
   + `strength_sessions` together, stored in `training_plans.plan_json`

Reached via `POST /api/plans/generate` (which calls `plans.generateAndStorePlan`
→ `aiCoach.generateWeeklyPlan`). `POST /coach/weekly-plan` returns the same
canonical plan. There are no separate nutrition/strength services or endpoints.

**AI Coach system prompt** includes:
- Athlete profile + current phase + CTL/ATL/TSB
- Recovery score (silent input — not shown to user)
- Last 10 workout feedback ratings
- Coach style preference (motivator / scientist / minimalist)
- Language: English

**Post-workout survey + feedback loop:**
- Shown ~after a ride syncs (`mobile/src/services/surveyTrigger.ts` decides when:
  duration > 15 min, ride ≤ 48h old, not already answered, 2h dismiss cooldown).
- 3 questions: completion (nailed it / mostly done / cut it short / skipped),
  effort (1–4), feeling (1–3).
- `POST /api/rides/:strava_id/feedback` → `rideFeedback.recordFeedback` upserts
  `workout_feedback` and generates brief coach feedback (`generateRideFeedback`,
  cached as `ride_feedback`). Shown on RideDetail; `GET .../feedback` reads it.
- `rideFeedback.getFeedbackSummary` feeds `buildCoachSystemPrompt`; deterministic
  rules set `plan_json.feedback_adjustment`, which fires the `plan_adjusted`
  push notification when next week's plan is generated.

---

## Strava Integration

- OAuth 2.0
- Full historical sync on first connect (all activities, paginated 200/page)
- Incremental sync: only activities newer than `last_activity_sync_at`
- Webhook: real-time new activity notifications
- Endpoints: `GET /athlete`, `GET /athlete/activities`, `GET /activities/:id/streams`
- Tokens stored encrypted in `strava_connections`

---

## Recovery System (Silent)

Recovery runs in background. **No UI shown** until feature flag enabled.

- Morning check-in: 5-emoji widget on Dashboard (5:00–11:00 only)
- Apple Health: HRV + sleep synced silently after onboarding
- Recovery score: calculated daily at 06:00 (Supabase Edge Function)
- Plan adaptation: training plan silently adjusts based on score
- Score < 40: replace today's workout with recovery ride
- Score 40–60: reduce intensity by one zone
- Score > 60: no change

When `recovery_screen` flag set to `true`: full Recovery tab appears
with all historical data already collected.

---

## Progressive Disclosure

Three knowledge levels control UI density:
- `beginner`: plain language only, no raw numbers
- `intermediate`: plain language + expandable numbers
- `advanced`: numbers by default, plain language as subtitle

Stored in `users.knowledge_level`.
Auto-upgrades based on behaviour (tapping "show more", tooltips, etc.).
Manual override in Profile settings.

---

## Coding Conventions

- TypeScript everywhere (mobile)
- `async/await` only — no raw Promise chains
- API responses: `{ success: boolean, data: any, error: string | null }`
- Never hardcode env variables
- RLS enabled on all Supabase tables
- All colors via `useTheme()` — never hardcoded
- All text via `docs/ui-copy.md` reference — never invented inline
- Feature flags checked via `useFeatureFlag(key)` hook
- Mock data via `DataSource` wrapper — never import device services directly

---

## Environment Variables

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Strava
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=
STRAVA_WEBHOOK_VERIFY_TOKEN=

# OpenAI
OPENAI_API_KEY=

# App
PORT=3000
NODE_ENV=development
MOCK_EXTERNAL_APIS=false
```

---

## Commands

```bash
# Backend
cd backend && npm run dev

# Mobile
cd mobile && npx expo start

# Seed dev data
npm run seed

# Clear dev data
npm run seed:clear

# Validate mock data
npm run validate:mock

# Docker
docker-compose up --build
```

---

## Docs Reference

All detailed prompts live in `/docs`. Use them with Claude Code.

| File | Contains |
|---|---|
| `ui-copy.md` | All UI text — labels, copy, notifications, empty states |
| `mvp-scope-v2.md` | Full v1.0 scope and timeline |
| `prompts-strava-sync.md` | Strava OAuth + sync engine |
| `prompts-unified-plan.md` | Phase engine + AI plan generator |
| `prompts-nutrition-strength.md` | Nutrition + strength plan + orchestrator |
| `prompts-ai-coach-core.md` | Post-workout feedback + notifications |
| `prompts-ai-cache.md` | AI caching system |
| `prompts-sledenje-napredku.md` | FTP, CTL/ATL/TSB, personal records |
| `prompts-razumljive-metrike.md` | Plain language metrics |
| `prompts-progresivno-razkrivanje.md` | Progressive disclosure system |
| `prompts-data-clarity.md` | Metric context engine, badges, tooltips, effort rating, App Store checklist |
| `prompts-aha-moments.md` | Make AI reasoning visible: first-sync reveal, plan reasoning, adaptive banner, progress signal, monthly reveal, daily context, sync insight |
| `prompts-design-athletic.md` | Design system (fonts, colors, screens) |
| `prompts-emerald-theme.md` | Emerald + black dark mode tokens |
| `prompts-recovery-hidden.md` | Recovery (background only, UI hidden) |
| `prompts-mock-data.md` | Dev without iOS device |
| `MASTER-PROMPT.md` | Starter prompt for new Claude Code sessions |
