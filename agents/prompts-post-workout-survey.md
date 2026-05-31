# Claude Code Prompts — Post-Workout Survey + Feedback Loop

Triggered 30 minutes after a Strava ride syncs.
3 questions. Under 20 seconds to complete.
This is how the AI gets smarter every week.

---

## 0. BEFORE YOU START

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Read docs/ui-copy.md section: POST-WORKOUT SURVEY for all text.
Read docs/prompts-design-athletic.md for design rules.

Key rules:
- Bottom sheet, NOT a full screen
- Maximum 3 questions — never more
- Large tap targets — user may be tired after riding
- Dismiss with swipe down or tap outside
- Auto-dismiss after 60 seconds if no interaction
- Save partial responses if dismissed early
```

---

## 1. DATABASE — WORKOUT FEEDBACK TABLE

```
Read CLAUDE.md and docs/agents/AGENT-DB.md.

Create migration for workout_feedback table:

workout_feedback:
- id (uuid, PK)
- user_id (uuid, FK → users)
- strava_activity_id (text) — links to rides.strava_id
- workout_date (date)
- planned_workout_type (text) — from training_plans.workouts
- planned_tss (float)
- actual_tss (float) — from synced ride
- completion_status (text) — 'completed' | 'partial' | 'skipped'
- perceived_effort (integer) — 1–4 (too easy / about right / hard / too much)
- post_feeling (integer) — 1–3 (fresh / normal / tired)
- coach_feedback (text) — AI generated, cached
- coach_feedback_generated_at (timestamp)
- created_at (timestamp)

Index on (user_id, workout_date DESC).
Index on (user_id, strava_activity_id).
UNIQUE on (user_id, strava_activity_id) — one feedback per ride.
Enable RLS.

Also add to ai_analysis_cache:
  analysis_type 'ride_feedback' with cache_key 'feedback_{strava_activity_id}'
  TTL: 8760h (permanent — ride data never changes)
```

---

## 2. TRIGGER LOGIC — WHEN TO SHOW SURVEY

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/services/surveyTrigger.ts

Logic for when to show the post-workout survey:

Show survey when ALL of these are true:
  1. A new ride was just synced from Strava
  2. The ride date matches today OR yesterday
  3. No feedback exists yet for this strava_activity_id
  4. Ride duration > 15 minutes (skip very short rides)
  5. App is in foreground OR user opens app within 4 hours of sync

Do NOT show if:
  - Ride is older than 48 hours
  - User already submitted feedback for this ride
  - Survey was dismissed without answering in last 2 hours (cooldown)

Implementation:
  Listen to Strava sync completion event (from stravaSync.js)
  Store pending surveys in AsyncStorage: pending_surveys: [strava_activity_id]
  On app foreground: check pending_surveys, show if conditions met
  On app start: check if any unanswered surveys from last 48h

Function: checkForPendingSurvey(userId): SurveyTrigger | null
Returns: { strava_activity_id, ride_title, distance_km, tss }
```

---

## 3. POST-WORKOUT SURVEY — BOTTOM SHEET

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section POST-WORKOUT SURVEY.

Create mobile/src/components/workout/PostWorkoutSurvey.tsx

Use @gorhom/bottom-sheet.
Sheet height: 320px (fits 3 questions comfortably)
Background: #FFFFFF light / #141413 dark
Handle bar at top (32px wide, 4px tall, #E8E8E6)

HEADER:
  Left: ride title + distance
    "Morning Ride · 68 km"
    BarlowCondensed-Bold 18px
  Right: dismiss X button

QUESTION 1 — Completion (always shown):
  "How did the workout go?"
  DMSans 15px, #111110

  4 large tappable options (full width buttons, stacked):
  
  ┌──────────────────────────────────┐
  │  ✓  Nailed it                    │
  ├──────────────────────────────────┤
  │  ~  Mostly done                  │
  ├──────────────────────────────────┤
  │  ↙  Cut it short                 │
  ├──────────────────────────────────┤
  │  ○  Skipped                      │
  └──────────────────────────────────┘

  Height per option: 48px
  Font: DMSans-Medium 15px
  Selected: bg #EFEFED, left border 3px #111110
  Icons: Feather set, 16px, left side

  If "Skipped" → skip Q2 and Q3, go straight to submit

QUESTION 2 — Effort (shown after Q1 if not skipped):
  Slides in from right (animated, 200ms)
  
  "How hard was it?"
  DMSans 15px

  4 emoji options in a row (large, equal spacing):
  😴        😊        😤        💀
  Too easy  About     Hard      Too much
            right

  Emoji: 32px
  Label: DMSans 11px, #6B6B69, below emoji
  Selected: circle bg #EFEFED, scale 1.1

QUESTION 3 — Feeling (shown after Q2):
  "How do you feel now?"
  DMSans 15px

  3 options in a row:
  Fresh     Normal    Tired
  😊        😐        😫

  Same style as Q2

SUBMIT:
  After Q3 answered → auto-submit after 800ms (no button needed)
  Brief success state: green checkmark + "Got it." (500ms)
  Then sheet dismisses automatically

  If user swipes down before completing:
    Save whatever was answered
    Mark survey as 'partial' — don't show again for this ride

Props:
  rideData: { strava_activity_id, title, distance_km, tss }
  onComplete: (feedback: WorkoutFeedback) => void
  onDismiss: () => void
```

---

## 4. AI COACH FEEDBACK GENERATION

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create backend/src/services/rideFeedback.js

Function: generateRideFeedback(userId, strava_activity_id, surveyResponse)

1. Check ai_analysis_cache for existing feedback
   cache_key: feedback_{strava_activity_id}
   If cached → return immediately

2. Gather context:
   - Full ride data from rides table (NP, TSS, duration, zones if available)
   - Planned workout for that day from training_plans
   - Survey response (completion, effort, feeling)
   - User profile (FTP, current CTL/ATL/TSB, phase)
   - Last 5 feedback entries (to spot patterns)

3. AI prompt (keep it SHORT — this is a quick insight, not an essay):

System: "You are a cycling coach giving brief post-ride feedback.
Max 2 sentences. Be specific to the numbers. 
Start with what went well. End with one actionable observation.
Never start with 'Great job' or 'Well done' — be direct.
Respond in English."

User: "Ride: {duration}min, NP {np}W ({pct_ftp}% FTP), TSS {tss}
Planned: {planned_type}, {planned_duration}min
Athlete felt: effort {effort}/4, feeling after {feeling}/3
Current phase: {phase}, TSB: {tsb}
Last 5 rides pattern: {pattern_summary}"

Example good outputs:
  "Power held steady through the first 90 minutes — VI of 1.04 shows 
   good pacing. The last 20 minutes dropped off; try saving 5% for the finish next time."

  "Solid threshold block. 96% of FTP for 45 minutes is right where 
   you want to be. Recovery tomorrow is important — TSB is at -18."

  "Shorter than planned but the power was there. 
   At this point in Build phase, quality beats volume every time."

4. Save to workout_feedback.coach_feedback
5. Save to ai_analysis_cache (TTL: permanent)
6. Return feedback text

Create route: POST /rides/:strava_id/feedback
  Body: { completion_status, perceived_effort, post_feeling }
  Saves survey + triggers generateRideFeedback()
  Returns: { feedback_text, cached: boolean }
```

---

## 5. FEEDBACK DISPLAY ON RIDE DETAIL

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update mobile/src/screens/RideDetailScreen.tsx to show
coach feedback after survey is submitted.

Coach feedback section (from docs/prompts-design-athletic.md):

  Thin separator line (1px #E8E8E6)

  "COACH" label
    10px uppercase, letterSpacing 0.7, #059669

  Feedback text
    DMSans 15px, #6B6B69, lineHeight 22
    2 sentences max

  Small "Cached · [date]" label if from cache
    10px, #ADADAA, right-aligned

  If no feedback yet (survey not done):
    Subtle prompt: "Rate this ride to get coach feedback →"
    DMSans 13px, #ADADAA
    Tappable → opens PostWorkoutSurvey sheet

Loading state (while AI generates):
  3 animated dots (pulse animation, green)
  "Your coach is reviewing this ride..."
  DMSans 13px, #6B6B69
```

---

## 6. FEEDBACK LOOP — AI LEARNS FROM SURVEY

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update backend/src/services/aiCoach.js to include
workout feedback in the weekly plan generation prompt.

In buildCoachSystemPrompt(athlete), add:

// Fetch last 10 feedback entries
const recentFeedback = await getFeedbackSummary(userId, 10)

Add to system prompt:
"Recent workout feedback (last 10 rides):
{recentFeedback.map(f => 
  `${f.workout_date}: ${f.planned_type}, effort ${f.perceived_effort}/4, 
   feeling ${f.post_feeling}/3, completion: ${f.completion_status}`
).join('\n')}

Patterns to consider:
- Completion rate: {completion_rate}%
- Average perceived effort: {avg_effort}/4
- Rides rated 'too hard' (4/4): {hard_count} in last 10
- Rides rated 'too easy' (1/4): {easy_count} in last 10"

Coaching rules based on patterns:
  If hard_count >= 3: reduce next week intensity by one zone
  If easy_count >= 3: increase next week TSS target by 5%
  If completion_rate < 70%: reduce workout count by 1, add note
  If post_feeling consistently tired (3/3): flag recovery concern

This is the feedback loop that makes the plan smarter every week.
```

---

## 7. WEEKLY PLAN ADJUSTMENT NOTIFICATION

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Add one notification type to notificationEngine.js:

PLAN ADJUSTED notification (triggered after weekly plan generates):

Fires only if plan was meaningfully changed based on feedback:
  - Intensity reduced due to too-hard feedback
  - Intensity increased due to too-easy feedback  
  - Volume reduced due to low completion rate

Message examples (from docs/ui-copy.md tone):
  Reduced: "Plan updated. Last week was tough — this week's 
            intensity is dialled back slightly."
  
  Increased: "Plan updated. You've been handling the load well —
              stepping it up a notch this week."
  
  Volume: "Plan updated. Fewer workouts this week — 
           better to nail 3 than rush through 5."

Only send if the change is > 10% different from what auto-generation
would produce without feedback adjustment.

Never: "Your training plan has been updated based on your feedback data."
Always: conversational, specific, no jargon.
```
