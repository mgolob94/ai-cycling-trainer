# Claude Code Prompts — Post-Workout Survey + AI Feedback Loop

Triggered after a Strava ride syncs. 3 questions, under 20 seconds.
This is how the coach gets smarter every week.

---

## 1. DATABASE — workout_feedback

```
Read CLAUDE.md and docs/agents/AGENT-DB.md.

Table: workout_feedback
  id                          uuid PK
  user_id                     uuid FK → users
  strava_activity_id          text   (links to rides.strava_id)
  workout_date                date
  planned_workout_type        text
  planned_tss                 real
  actual_tss                  real
  completion_status           text   (completed | partial | skipped)
  perceived_effort            integer (1–4)
  post_feeling                integer (1–3)
  coach_feedback              text
  coach_feedback_generated_at timestamptz
  created_at                  timestamptz

Index  on (user_id, workout_date DESC)
Unique on (user_id, strava_activity_id)   — one feedback per ride
RLS enabled (owner-scoped).

Also: ai_analysis_cache analysis_type 'ride_feedback',
  cache_key 'feedback_{strava_activity_id}', TTL permanent (8760h).
```

---

## 2. SURVEY TRIGGER — when to show

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/services/surveyTrigger.ts.

Show survey when ALL:
  - a new ride was just synced
  - ride date is today OR yesterday
  - no feedback exists yet for this strava_activity_id
  - ride duration > 15 min
  - app in foreground (or opened within 4h of sync)

Don't show if:
  - ride older than 48h
  - already answered
  - dismissed without answering < 2h ago (cooldown)

Function: checkForPendingSurvey(userId): SurveyTrigger | null
  → { strava_activity_id, ride_title, distance_km, tss }
Store pending/answered/dismissed state in AsyncStorage.
```

---

## 3. POST-WORKOUT SURVEY — bottom sheet

```
Read CLAUDE.md, docs/ui-copy.md (POST-WORKOUT SURVEY), docs/prompts-design-athletic.md.

Create mobile/src/components/workout/PostWorkoutSurvey.tsx.
Use @gorhom/bottom-sheet. Sheet height ~320px. Handle bar on top.

Header: ride title + distance, dismiss X.

Q1 "How did the workout go?" — 4 stacked options (48px tall):
  ✓ Nailed it · ~ Mostly done · ↙ Cut it short · ○ Skipped
  Skipped → skip Q2 + Q3, submit immediately.

Q2 "How hard was it?" — 4 emoji in a row:
  😴 Too easy · 😊 About right · 😤 Hard · 💀 Too much   (1–4)

Q3 "How do you feel now?" — 3 emoji in a row:
  😊 Fresh · 😐 Normal · 😫 Tired   (1–3)

After Q3 answered → auto-submit after 800ms.
Success: green checkmark + "Got it." (~500ms) then auto-dismiss.
If dismissed early (swipe/tap-outside): save whatever was answered (partial).
```

---

## 4. AI COACH FEEDBACK

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create backend/src/services/rideFeedback.js.

generateRideFeedback(userId, strava_activity_id, surveyResponse):
  1. Check ai_analysis_cache (key feedback_{strava_id}) — return if hit.
  2. Gather: ride data + planned workout for that day + survey response
     + user profile (FTP, phase, TSB) + last 5 feedback entries.
  3. AI: max 2 sentences, specific to the numbers, direct tone.
     Start with what went well, end with one actionable observation.
     Never open with "Great job".
     e.g. "Power held steady — VI 1.04 shows good pacing. Last 20 min
          dropped; save 5% for the finish next time."
  4. Save to workout_feedback.coach_feedback + ai_analysis_cache (permanent).

Route: POST /rides/:strava_id/feedback
  Body: { completion_status, perceived_effort, post_feeling }
  Saves survey + triggers generateRideFeedback. Returns { feedback_text, cached }.
```

---

## 5. FEEDBACK ON RIDE DETAIL

```
Read CLAUDE.md and docs/prompts-design-athletic.md.

Update RideDetailScreen to show coach feedback after the survey.

  "COACH" label — 10px uppercase, #059669
  Feedback text — DMSans 15px, #6B6B69, 2 sentences max
  Cached label — "Cached · {date}", 10px #ADADAA, right-aligned (if from cache)
  No feedback yet → "Rate this ride to get coach feedback →" (tappable, opens sheet)
  Loading → 3 animated dots + "Your coach is reviewing this ride…"
```

---

## 6. FEEDBACK LOOP — weekly plan

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update backend/src/services/aiCoach.js. In buildCoachSystemPrompt(), add the
last 10 feedback entries + patterns:
  - completion rate %
  - average perceived effort /4
  - rides rated 'too hard' (4/4) count
  - rides rated 'too easy' (1/4) count

Coaching rules:
  hard_count >= 3        → reduce next week intensity by one zone
  easy_count >= 3        → increase weekly TSS target by ~5%
  completion_rate < 70%  → reduce workout count by 1, add a reassuring note
  post_feeling tired (3/3)→ flag a recovery concern
```

---

## 7. PLAN-ADJUSTED NOTIFICATION

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Add a notification type to notificationEngine.js. Fire only if the plan was
meaningfully changed by feedback (> ~10% vs. the un-adjusted plan):

  Reduced:  "Plan updated. Last week was tough — intensity dialled back slightly."
  Increased:"Plan updated. You've been handling the load well — stepping it up a notch this week."
  Volume:   "Plan updated. Fewer workouts this week — better to nail 3 than rush through 5."

Never jargon. Always conversational, specific, no data-speak.
```
