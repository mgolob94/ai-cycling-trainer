# Claude Code Prompts — Poenotenjen Plan Sistem

En plan. Ena logika. Faza se določi avtomatsko.
Brez eventa: Base → Build → Peak avtomatsko.
Z eventom: backwards od datuma.

---

## 1. DATABASE — POENOTENJEN PLAN SISTEM

```
Read CLAUDE.md. Create a Supabase SQL migration that replaces any existing
separate weekly_plans and season_plans tables with one unified system.

DROP (if exists): season_plans table
KEEP and UPDATE: training_plans table

Updated training_plans table:
- id (uuid, PK)
- user_id (uuid, FK → users)
- week_start (date)                    — Monday of the week
- phase (text)                         — 'base' | 'build' | 'peak' | 'recovery'
- phase_week (integer)                 — which week within the phase (1, 2, 3, 4...)
- phase_total_weeks (integer)          — total weeks in this phase
- tss_target (integer)
- week_theme (text)                    — e.g. "Aerobna osnova — dolge Z2 vožnje"
- coach_intro (text)                   — AI generated intro for this week
- workouts (jsonb)                     — array of workout objects
- adapted_workout (jsonb)              — recovery-adjusted version if different
- completion_pct (integer)             — filled in at end of week (0-100)
- tss_achieved (integer)               — actual TSS from Strava
- generated_at (timestamp)
- cache_key (text)                     — week_{YYYY-WW}
- is_cached (boolean, default true)

Add to users table:
- current_phase (text)                 — 'base' | 'build' | 'peak' | 'recovery'
- phase_started_at (date)              — when current phase began
- target_event_name (text)            — e.g. "Gran Fondo Žiri"
- target_event_date (date)            — NULL if no event
- season_start_date (date)            — when did this season begin (default: Jan 1)
- available_days_per_week (integer)   — how many days user can train (3-6)
- preferred_long_ride_day (text)      — 'saturday' | 'sunday'

Create phase_history table (audit log of phase transitions):
- id (uuid, PK)
- user_id (uuid, FK → users)
- phase (text)
- started_at (date)
- ended_at (date)
- reason (text)    — 'automatic' | 'event_driven' | 'manual'
```

---

## 2. PHASE ENGINE — AVTOMATSKA DOLOČITEV FAZE

```
Read CLAUDE.md. Create backend/src/services/phaseEngine.js —
the core logic that determines which training phase a user is in.

This runs every Monday morning and after every FTP test.

Function: determinePhase(userId): PhaseResult

TWO PATHS:

PATH A — Brez eventa (no target_event_date):
  Pure progression based on CTL and consistency:

  Base phase conditions:
  - CTL < 50 → always Base (not enough foundation)
  - CTL 50–70 AND in Base < 6 weeks → continue Base
  - CTL 50–70 AND in Base 6+ weeks → move to Build
  - New user (< 4 weeks data) → always Base

  Build phase conditions:
  - CTL > 50 AND completed 6+ weeks Base → Build
  - CTL 70–90 AND in Build < 6 weeks → continue Build
  - CTL > 90 OR in Build 6+ weeks → move to Peak

  Peak phase conditions:
  - CTL > 70 AND completed Build → Peak (4 weeks max)
  - After 4 weeks Peak → Recovery week, then restart Build

  Recovery week (automatic):
  - Every 4th week: TSS drops 40%, all Z5/Z6 replaced with Z2
  - After recovery: resume previous phase week count

  TSB override:
  - If TSB < -20 for 5+ consecutive days → force Recovery week regardless of phase
  - Resume phase after Recovery

PATH B — Z eventom (target_event_date set):
  Backwards planning from event date:

  weeks_to_event = (target_event_date - today) / 7

  if weeks_to_event > 16:
    phase = 'base'
  elif weeks_to_event > 8:
    phase = 'build'
  elif weeks_to_event > 3:
    phase = 'peak'
  elif weeks_to_event <= 3:
    phase = 'taper'  (new phase: reduce volume 40%, keep intensity)
  
  Recovery weeks: automatically inserted every 4th week in each phase

Return:
{
  phase: string,
  phase_week: number,
  phase_total_weeks: number,
  weeks_to_event: number | null,
  tss_target: number,           — calculated per phase (see below)
  rationale: string,            — plain language why this phase
  next_phase: string,           — what comes next
  weeks_until_next_phase: number
}

TSS targets per phase (based on user's avg TSS last 4 weeks = baseline):
  base:     baseline * 0.9   — slightly below average, focus on consistency
  build:    baseline * 1.1   — 10% above average
  peak:     baseline * 1.2   — 20% above average
  recovery: baseline * 0.6   — 40% reduction
  taper:    baseline * 0.55  — 45% reduction before event

Save result to users table (current_phase, phase_started_at).
Log phase transitions to phase_history.
```

---

## 3. AI PLAN GENERATOR — POSODOBLJEN Z FAZAMI

```
Read CLAUDE.md. Update backend/src/services/aiCoach.js generateWeeklyPlan()
to use phase context from phaseEngine.

New input to generateWeeklyPlan(userId, weekStart):
  1. phaseResult from determinePhase(userId)
  2. athlete context (existing)
  3. recovery score (existing)
  4. last 3 weeks completion % (existing)

Updated AI prompt:

"Generate a training plan for week starting {weekStart}.

PHASE CONTEXT:
Phase: {phase} (week {phase_week} of {phase_total_weeks})
{if event}: Event '{event_name}' in {weeks_to_event} weeks
{if no event}: Building toward peak fitness — no specific event
TSS target this week: {tss_target}
Phase rationale: {rationale}

PHASE-SPECIFIC INSTRUCTIONS:
{if base}:
  Focus: Aerobic base building. 85% of workouts in Z1-Z2.
  Key workout: one long ride (90-150min) on {preferred_long_ride_day}.
  Avoid: Z5-Z6 efforts. Athlete needs foundation first.
  Goal: Build CTL steadily, establish consistency.

{if build}:
  Focus: Raising threshold and VO2max. 75% Z1-Z2, 25% Z3-Z5.
  Key workouts: 1x threshold (Z4), 1x sweet spot (Z3-Z4), 1x long ride.
  Introduce: 1 interval session per week maximum.
  Goal: Increase FTP and ability to sustain effort.

{if peak}:
  Focus: Race-specific fitness. Sharpen form. 70% Z1-Z2, 30% Z4-Z6.
  Key workouts: 1x VO2max intervals, 1x threshold, 1x long ride.
  Goal: Bring CTL to maximum while maintaining freshness.

{if recovery}:
  Focus: Full recovery. Only Z1-Z2. No intensity whatsoever.
  Reduce total duration by 40% from last week.
  Goal: Let body adapt to previous weeks of training.
  Coach message: Acknowledge this feels too easy — that's correct.

{if taper}:
  Focus: Arrive fresh at event. Reduce volume, keep intensity.
  Cut volume 40%, keep 2 short intensity sessions (Z4, 20 min max).
  Goal: Empty fatigue tank, keep engine revved.

RECOVERY ADJUSTMENT:
Today's recovery score: {recovery_score}
{if recovery < 60}: Reduce all intensities by 1 zone. Replace Z5 with Z4, Z4 with Z3.
{if recovery < 40}: Replace all intensity with Z2. Add note explaining why.

Return same JSON schema as before with added fields:
  phase: string,
  phase_week: number,
  phase_rationale: string  — 1 sentence why this phase
"

Cache key: week_{YYYY-WW}
TTL: 168h (invalidate if recovery drops < 40 or new FTP test)
```

---

## 4. MOBILE — POENOTENJEN PLAN ZASLON

```
Read CLAUDE.md. Redesign the training plan UI into one unified screen:
mobile/src/screens/PlanScreen.tsx

This screen replaces both WeeklyPlanScreen and SeasonPlanScreen.

LAYOUT — 3 sekcije v enem scrollu:

──────────────────────────────
SEKCIJA 1 — PHASE HEADER (sticky top)
──────────────────────────────
Compact phase indicator:
  Left: phase badge (color-coded) + "Teden X od Y"
  Center: phase name in plain language
  Right: weeks to event OR "Napredek ↑" if no event

Phase badge colors:
  base:     sky-500     "Osnova"
  build:    primary-600 "Gradnja"     ← emerald
  peak:     amber-500   "Vrhunec"
  recovery: slate-400   "Regeneracija"
  taper:    rose-500    "Tapering"

Progress bar below: phase progress (phase_week / phase_total_weeks)
  e.g. "████████░░░░  Teden 2 od 6"

──────────────────────────────
SEKCIJA 2 — TA TEDEN (primary content)
──────────────────────────────
Coach intro card (Card variant='tinted'):
  AI-generated intro text for this week
  1-2 sentences, warm and specific
  "Ta teden gradimo aerobno osnovo. Fokus je na enakomerni moči — brez hitenja."
  Small "cached" badge + refresh icon (from ai cache system)

Workout list — one card per day:
  Monday through Sunday
  Empty days: subtle "Počitek" row (no card, just text)
  Today: highlighted with primary border
  Completed: green checkmark overlay
  Skipped: greyed out

Each workout card:
  Left accent bar (zone color)
  Title + duration
  Zone badge
  ★ star if key workout of the week
  Tap → opens WorkoutDetailScreen

──────────────────────────────
SEKCIJA 3 — SEZONA NAZAJ (collapsible)
──────────────────────────────
"Zgodovina" section header with chevron (collapsed by default)

When expanded: horizontal timeline of last 8 weeks
Each week: small card showing:
  - Week label (T-8, T-7, ... Ta teden)
  - Phase badge
  - Completion % (filled arc)
  - TSS bar

Color coding:
  > 90% completion: emerald dot
  60-90%: amber dot
  < 60%: rose dot
  Recovery week: slate dot

This replaces the entire "Season Plan" screen —
history is visible but secondary to the current week.
```

---

## 5. EVENT SETUP FLOW

```
Read CLAUDE.md. Create mobile/src/components/plan/EventSetup.tsx —
a simple event/goal setup that feeds into the phase engine.

Accessible from:
  - Onboarding (optional step)
  - Dashboard banner "Dodaj cilj →"
  - Plan screen header "+" button

STEP 1 — Ali imaš ciljni event?
  Two large cards:
  
  Card A: "Imam specifičen datum"
    Icon: 🏁
    Examples: "Gran Fondo, dirka, maraton, sportif..."
    → goes to Step 2
  
  Card B: "Treniram za napredek"
    Icon: 📈
    Description: "AI bo gradil tvojo formo skozi sezono brez specifičnega cilja"
    → saves no event, closes flow
    → phase engine uses PATH A (automatic progression)

STEP 2 — Event podrobnosti (only if Card A):
  Text input: "Ime eventa" (e.g. "Gran Fondo Žiri")
  Date picker: "Datum eventa"
  
  Validation:
  - Event must be > 3 weeks away (less = taper only, show warning)
  - Event must be < 52 weeks away (further = suggest re-setting closer to date)

STEP 3 — Potrditev:
  Show phase plan preview:
  "Na osnovi datuma eventa ({event_date}), imaš {weeks} tednov.
  
  Tvoj plan:
  📗 Osnova:   {n} tednov (od danes do {date})
  📘 Gradnja:  {n} tednov ({date} – {date})
  📙 Vrhunec:  {n} tednov ({date} – {date})
  📕 Tapering: 3 tedne pred eventom
  
  AI bo vsak teden generiral specifičen plan za tvojo fazo."
  
  [Začni trening →] button

On save: update users table (target_event_name, target_event_date)
Trigger: recalculate current phase immediately
```

---

## 6. PHASE TRANSITION NOTIFICATION

```
Read CLAUDE.md. Add phase transition notifications to notificationEngine.js.

When determinePhase() returns a new phase different from current_phase:

1. Save transition to phase_history
2. Update users.current_phase and users.phase_started_at
3. Send push notification:

  base → build:
    "Osnova je zgrajena 💪 Začenjamo Build fazo — čas za intenzivnejše treninge!"
  
  build → peak:
    "Forma je visoka ⚡ Vstopamo v Peak fazo. {weeks} tednov do vrhunca sezone."
  
  peak → recovery:
    "Regeneracijski teden 🔄 Telo potrebuje počitek pred zadnjim sunkom."
  
  any → taper (3 weeks before event):
    "Tapering se začne! 🏁 {event_name} je čez {n} dni. Zmanjšujemo volumen, formo ohranjamo."
  
  recovery → base/build/peak (resuming):
    "Regeneracija končana ✓ Nadaljevamo z {phase} fazo — sveži in pripravljeni!"

4. On Dashboard, show a one-time phase transition card (dismissible):
   Large phase badge + transition message + "Poglej nov plan →" CTA
   Disappears after user taps it or after 48h

Never send phase transition notification between 22:00 and 07:00.
```

---

## 7. POSODOBI CLAUDE.md — PLAN SISTEM

```
Read CLAUDE.md. Update the CLAUDE.md file in the project root to reflect
the new unified plan system. Replace any references to separate
weekly_plans and season_plans with the unified training_plans table.

Update the Database Schema section:

training_plans:
  - Unified table for all plan data
  - phase field determines training context
  - workouts (jsonb) contains the weekly schedule
  - completion_pct and tss_achieved filled retrospectively

users (new fields):
  - current_phase, phase_started_at
  - target_event_name, target_event_date
  - available_days_per_week, preferred_long_ride_day

phase_history:
  - Audit log of all phase transitions

Add new section "Plan System":
  "The app uses ONE unified training plan system.
   There is no separate season plan.
   Phases (base/build/peak/recovery/taper) are determined automatically
   by phaseEngine.js every Monday.
   The weekly plan is generated by aiCoach.js using the current phase as context.
   History of past weeks is shown in the Plan screen (collapsed by default).
   All plans are cached in ai_analysis_cache."
```
