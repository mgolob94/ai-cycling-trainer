# AI Coach — Research + Claude Code Prompts

---

## KONKURENČNA ANALIZA

### Kaj počnejo najboljši:

**TrainerRoad** — benchmark v industriji
- AI treniran na 250M+ aktivnostih
- Adaptive Training: po vsaki vožnji sprašuje perceived effort (RPE survey)
- Ta dvojni sistem (AI data + subjektivni občutek) je njihova ključna diferenciacija
- Slabost: preveč fokusiran na indoor, slabo za nestrukturirane outdoor vožnje

**Xert** — najboljša fitness matematika
- Dynamic Fitness Signature — ne fixed FTP ampak kontinualno posodobljeno
- Real-time W' balance med vožnjo
- Slabost: preveč kompleksen UI, strma krivulja učenja

**JOIN Cycling** — najboljši za začetnike
- Najlažji onboarding v industriji
- Plan se prilagaja glede na razpored (ne samo fitness)
- Slabost: manj napredne analitike

**Spoked** — najboljša prilagodljivost življenjskemu slogu
- "Life rarely goes to plan" — plan se prilagaja ko izpustiš trening
- Slabost: manj data-driven, bolj coach-driven

**NUA Coach** — conversational delivery (WhatsApp/Telegram)
- Coaching ki pride k tebi, ne obratno
- Slabost: ni rich UI, samo messaging

### KJE IMAMO PRILOŽNOST (kaj nihče ne dela dobro):

1. **Recovery-aware planning** — nihče ne integrira HRV + spanec + ATL v en unified recovery score ki dejansko spremeni plan
2. **Plain language za začetnike** — vsi so preveč tehnični
3. **Conversational AI coach** — ne samo plan generator ampak coach ki te pozna in komunicira kot oseba
4. **Smart notifications** — vsi spamajo, nihče ne dela contextual timing
5. **Mobile-first** — večina je desktop web first
6. **Motivacija brez greenwashing** — nihče ne dela celebrations prav

---

## CLAUDE CODE PROMPTS

### 1. AI COACH ENGINE — SISTEM PROMPT (CORE)

```
Read CLAUDE.md. Create backend/src/services/aiCoach.js — the heart of the application.

This is NOT a simple plan generator. This is a persistent AI coach that knows
the athlete deeply and communicates like a real person.

Build the master system prompt builder: buildCoachSystemPrompt(athlete):

The system prompt must include:

COACH PERSONA:
"You are a professional cycling coach with 15 years of experience coaching
amateur and recreational cyclists. You are warm, encouraging, and direct.
You explain things simply without jargon. You celebrate wins genuinely.
You warn about overtraining firmly but kindly. You always give a reason
for every recommendation. You speak in first person as a coach, not as an AI.
Respond in Slovenian language."

ATHLETE CONTEXT (injected dynamically):
- Name, age, weight
- Current FTP, W/kg, rider category
- Training goal and target event (if any)
- Weeks of training history (how long have they been consistent?)
- Current CTL, ATL, TSB in plain terms:
  "Athlete's fitness (CTL): 74 — good amateur level, building steadily"
  "Athlete's fatigue (ATL): 62 — moderate, last week was active"  
  "Athlete's form (TSB): +12 — fresh and ready"
- Recovery score today: 78 — good readiness
- Last FTP test: 287W (+12W from previous, 4 weeks ago)
- Training consistency: "Has trained 4.2 days/week on average for 8 weeks"
- Rider type: "Time Trialist profile — strong sustained power, weaker sprint"
- Current periodization phase: "Build phase, week 5 of 8"
- Recent training pattern: "Last 3 weeks: Z2 heavy (75%), threshold (20%), VO2 (5%)"
- Last 3 rides summary
- Any warnings: "Missed 2 workouts last week", "HRV trending down 3 days"

OUTPUT FORMAT INSTRUCTIONS:
"Always respond with valid JSON matching the exact schema provided.
Never add markdown, never add explanation outside JSON.
All text fields are in Slovenian.
Workout descriptions use plain language — no zone numbers in primary text."

Build separate functions for each coaching task — see prompts below.
Each function follows the pattern:
  1. Build system prompt with buildCoachSystemPrompt(athlete)
  2. Build specific task prompt
  3. Call OpenAI API (model: claude-sonnet-4-20250514 via Anthropic API or gpt-4o)
  4. Parse and validate JSON response
  5. Save to ai_analysis_cache with appropriate TTL
  6. Return result
```

---

### 2. TEDENSKI PLAN GENERATOR

```
Read CLAUDE.md. Create the weekly training plan generation function in backend/src/services/aiCoach.js.

Function: generateWeeklyPlan(userId, weekStart)

Input data gathered before AI call:
- Full athlete context (from buildCoachSystemPrompt)
- Available training days this week (from user calendar preferences)
- Recovery score for today
- Last 4 completed weeks of training (TSS, distance, workouts)
- Whether last week's plan was completed (% completion)
- Any upcoming events or races in next 4 weeks
- Current periodization phase

Task prompt for AI:
"Generate a personalized training plan for the week starting {weekStart}.

The athlete is in {phase} phase. Recovery today is {recovery_score}/100.
Last week they completed {completion_pct}% of planned workouts.
Available training days: {available_days}.

Generate EXACTLY {n_days} workouts for this week.
Respect the 80/20 rule: 80% low intensity (Z1-Z2), 20% high intensity.
Ensure at least 1 full rest day.
Consider recovery score: if < 60, reduce intensity across all workouts.

Return JSON:
{
  week_theme: string,            // e.g. 'Osnovna vzdržljivost + en intervalni trening'
  coach_intro: string,           // 2-3 sentence personal intro from coach
  tss_target: number,
  workouts: [
    {
      day: 'monday' | 'tuesday' | ...,
      type: 'endurance' | 'threshold' | 'vo2max' | 'recovery' | 'rest' | 'long_ride',
      title: string,             // e.g. 'Dolga aerobna vožnja'
      duration_min: number,
      intensity_zone: number,    // 1-6
      description: string,       // plain language, what to do and why
      key_metric: string,        // e.g. 'Ostani pod 75% FTP ves čas'
      coach_tip: string,         // personal tip for this workout
      is_key_workout: boolean    // highlight the most important workout of week
    }
  ],
  week_focus: string,            // one sentence what this week builds
  warning: string | null         // e.g. overtraining warning
}

Cache key: week_{ISO_week_number}
TTL: 168 hours (1 week)
Invalidate if: new FTP test, recovery score drops below 40, user manually requests new plan"
```

---

### 3. POST-WORKOUT FEEDBACK LOOP

```
Read CLAUDE.md. This is the feature that makes the AI coach actually LEARN.
After every completed workout, collect feedback and update the model's context.

Create mobile/src/components/workout/PostWorkoutSurvey.tsx:

Triggered automatically 30 minutes after a Strava activity is synced.
Shows as a bottom sheet — quick, max 30 seconds to complete.

SURVEY (3 questions max, never more):

Question 1 — Completion:
"Kako je šel trening?" 
  ✓ Opravil sem vse     (completed as planned)
  ~ Opravil sem delno   (partial completion)
  ✗ Nisem treniral      (skipped)

Question 2 — Perceived effort (only if completed):
"Kako naporno je bilo?"
5 emoji scale:
😴 Prelahko  😊 Lahko  😐 Ravno prav  😤 Težko  💀 Premočno

Question 3 — How do you feel now? (only if completed):
"Kako se počutiš zdaj?"
  Sveže    Normalno    Utrujeno

Submit → one tap → dismiss.

Backend: POST /workouts/feedback
Save to workout_feedback table:
  user_id, workout_date, strava_activity_id,
  completion_status, perceived_effort (1-5), post_feeling (1-3),
  planned_tss, actual_tss, created_at

Use this data in buildCoachSystemPrompt():
  "Last 10 workouts feedback: [array of {date, type, perceived_effort, completion}]"
  "Pattern: Athlete consistently rates Z4 workouts as 'very hard' — may need FTP recheck"
  "Completion rate: 87% over last 30 days — very consistent"

This feedback loop is what separates a real AI coach from a plan generator.
TrainerRoad built their entire advantage on this — implement it properly.
```

---

### 4. PROGRESS MONITORING — MESEČNI PREGLED

```
Read CLAUDE.md. Create backend/src/services/progressMonitor.js that runs
a monthly progress analysis for each user.

Schedule: runs on the 1st of each month via Supabase Edge Function cron.
Also callable manually via POST /progress/monthly-review.

Function: generateMonthlyReview(userId, month):

Gather:
- This month vs last month: TSS, distance, elevation, ride count
- FTP change (if tested this month)
- CTL change (fitness trend)
- Goal progress: are they on track for their target event?
- Consistency score: % of planned workouts completed
- Best achievements: new PRs, longest ride, highest single-day TSS
- Biggest challenge: what was hard, what was skipped

AI prompt produces:
{
  month_label: string,               // "Maj 2026"
  headline: string,                  // "Odličen mesec — fitnes narasel za 8 točk!"
  summary: string,                   // 3-4 sentences, personal and specific
  achievements: string[],           // list of genuine wins (max 3)
  challenges: string[],             // honest assessment (max 2)
  next_month_focus: string,         // one clear priority
  on_track_for_goal: boolean,
  goal_message: string,             // "Na dobri poti za Gran Fondo v septembru"
  fitness_change: {
    ctl_change: number,
    label: string                    // "Fitnes narasel za 8 točk (+12%)"
  },
  coach_message: string             // personal message from coach, warm and specific
}

Cache: TTL 720h (1 month). Key: monthly_{YYYY-MM}
Push notification when ready: "Tvoj mesečni pregled je pripravljen 📊"
Save to ai_analysis_cache with analysis_type = 'monthly_review'.
```

---

### 5. TEDNIK PROGRESS CHECK-IN

```
Read CLAUDE.md. Create backend/src/services/weeklyCheckIn.js —
a mid-week and end-of-week check-in system.

TWO CHECK-INS PER WEEK:

1. Wednesday mid-week check (runs Wed 18:00):
   - How is the week going vs plan?
   - Remaining workouts for the week
   - Adjust if needed based on:
     * Recovery score today
     * Workouts completed so far
     * Weekend weather forecast (future feature placeholder)

   AI produces:
   {
     check_in_type: 'midweek',
     progress_label: string,       // "Dobro napredujete — 2 od 4 treningov opravljenih"
     remaining_workouts: number,
     adjustment_needed: boolean,
     adjustment_message: string | null,  // "Glede na utrujenost priporočam..."
     motivation_message: string         // short encouraging line
   }

2. Sunday end-of-week review (runs Sun 20:00):
   - Full week recap
   - TSS achieved vs planned
   - What worked, what didn't
   - Preview of next week

   AI produces:
   {
     check_in_type: 'endofweek',
     week_score: number,           // 1-10 how good was the week
     week_label: string,           // "Odličen teden! 🎉"
     tss_achieved: number,
     tss_planned: number,
     completion_pct: number,
     coach_feedback: string,       // 2-3 sentences, specific and personal
     next_week_preview: string,    // teaser for next week
     celebration: string | null    // if week_score > 8: special message
   }

Cache: midweek_{YYYY-WW}, endofweek_{YYYY-WW}
TTL: 72h for midweek, 168h for end-of-week
Send push notification when each check-in is ready.
```

---

### 6. SMART PUSH NOTIFICATIONS — SISTEM

```
Read CLAUDE.md. Create backend/src/services/notificationEngine.js —
the notification strategy engine.

PHILOSOPHY:
- Maximum 2 notifications per day
- Never notify during sleep hours (22:00–07:00)
- Never send same type twice in 48h
- Contextual timing: notify when most relevant, not on a fixed schedule
- Tone: warm coach, never pushy, never guilt-tripping
- Celebrations are GENUINE — not triggered by low bars

NOTIFICATION TYPES AND TRIGGERS:

1. MORNING READINESS (07:15, daily):
   Only if recovery score is calculated for today.
   Content varies by score:
   85+: "Vrhunska forma danes ⚡ — idealen dan za intervale ali dolgo vožnjo"
   70-84: "Dobra pripravljenost 🟢 — treniraj po planu"
   50-69: "Zmerna pripravljenost 🟡 — zmanjšaj intenzivnost"
   30-49: "Počasneje danes 🟠 — lahka vožnja ali počitek"
   <30:   "Telo prosi za počitek 🔴 — danes brez treninga"
   Skip if: user already opened app today (they've seen it)

2. WORKOUT REMINDER (1h before planned workout time, if set):
   "Čez uro te čaka [workout_title] 🚴 — [coach_tip from plan]"
   Skip if: recovery score < 40 (body needs rest, not a reminder)

3. MILESTONE CELEBRATIONS (triggered by events):
   New PR:         "Nov osebni rekord! 5-minutna moč: [X]W 🏆"
   FTP increase:   "FTP narasel na [X]W ([+Y]W) — trdega dela je vredno 💪"
   Consistency:    "7 dni zapored na kolesu 🔥 — taka doslednost gradi šampione"
   CTL milestone:  "Fitnes prečkal mejo 80 — elitni amater nivo! 🎖️"
   First 100km:    "Prva stokica! [X]km danes 🎉"
   Goal on track:  Celebrate every 25% progress toward goal

4. LACK OF PROGRESS (gentle, max 1x per 2 weeks):
   Trigger: TSS declined 3 consecutive weeks AND no injury reported
   Message: "Zadnje 3 tedne je bilo mirnejše. Vse ok? [Coach name] te čaka z novim planom."
   Never: "Nisi treniral" — always frame positively

5. WEEKLY CHECK-IN READY:
   "Tvoj tedenski pregled je pripravljen 📊 — [week_label]"
   Time: Sunday 20:30

6. MONTHLY REVIEW READY:
   "Mesec za tabo: [headline] — poglej pregled 🗓️"
   Time: 1st of month, 09:00

7. STRAVA SYNC SUCCESS (only if new activities):
   "Nova vožnja sinhronizirana ✓ — [distance]km, [NP]W povprečna moč"
   Only if user hasn't opened app in 4+ hours

8. INACTIVITY (very gentle, max 1x per 3 weeks):
   Trigger: no rides in 10+ days AND user was previously consistent
   NOT: "Nisi treniral 10 dni" — NEVER guilt
   YES: "Hej, [name] — vse ok? Kadar si pripravljen, je plan tukaj 🚴"

ANTI-SPAM RULES:
- Track all sent notifications in notifications_sent table
- Check before every send: type, last_sent, user preferences
- User can disable each category in settings
- "Quiet mode": user can set hours when no notifications (default: 22:00–07:00)
- If user ignores 5 consecutive notifications of same type → auto-disable that type

Create table notifications_sent:
  user_id, notification_type, sent_at, was_opened, deep_link
```

---

### 7. AI COACH CHAT (conversational layer)

```
Read CLAUDE.md. Create a conversational AI coach feature:
backend/src/routes/coach.js and mobile/src/screens/CoachChatScreen.tsx.

This is different from plan generation — it's a real conversation.
Think NUA Coach but with a proper app interface.

Backend: POST /coach/message
Body: { message: string, conversationHistory: Message[] }

Backend logic:
1. Build full athlete context (buildCoachSystemPrompt)
2. Add conversation history (last 10 messages)
3. Add instruction: "Answer as a cycling coach in Slovenian. Be concise — max 3 sentences unless asked for more. If the athlete asks about their plan, reference their actual data. If they report a problem (injury, fatigue, life event), update your recommendation accordingly."
4. Call AI API
5. Parse response
6. Detect intents in response:
   - If coach suggests changing plan → flag for user to confirm
   - If coach detects injury mention → flag + suggest rest
   - If coach answers about workouts → include deep link to that workout
7. Return: { message, intent, suggested_action }

DO NOT cache chat responses — they must always be fresh.
But DO inject cached weekly plan and metrics into every prompt.

Mobile screen: CoachChatScreen.tsx
- Chat bubble UI (think iMessage style but with coach avatar)
- Coach avatar: simple slate circle with "C" monogram + "AI Trener" label
- Messages appear with typing indicator (3 dots) before response
- Suggested quick replies below input (context-aware):
  "Kako je z mojo formo?" | "Kaj treniramo jutri?" | "Sem utrujen" | "Nov cilj"
- Input: text field + send button
- Accessible from: tab bar OR from within any workout card via "Vprašaj trenerja"

Usage limits (enforce in backend):
  Free plan: 5 messages/month
  Basic: 30 messages/month  
  Pro: unlimited

Show remaining messages counter when < 5 remaining.
```

---

### 8. PROGRESS TRACKING — GOAL SYSTEM

```
Read CLAUDE.md. Create a goal tracking system that gives the AI coach a target
to coach toward.

Database: create goals table:
  id, user_id, goal_type, title, target_date, target_ftp, target_distance_km,
  target_event_name, current_progress (0–100), status ('active'|'completed'|'abandoned'),
  created_at

Goal types:
  'ftp_target':    reach a specific FTP (e.g. "Doseči 300W FTP")
  'event':         prepare for a specific event (e.g. "Gran Fondo Žiri september")
  'consistency':   ride X days per week for Y weeks
  'distance':      ride X km total by date
  'fitness':       reach CTL target

Create backend/src/services/goalTracker.js:

1. calculateGoalProgress(userId, goalId): number (0–100)
   - For FTP goal: (current_ftp - start_ftp) / (target_ftp - start_ftp) * 100
   - For event: weeks_trained / weeks_available * completion_rate * 100
   - For consistency: consecutive_weeks_meeting_target / target_weeks * 100

2. generateGoalInsight(userId, goal): GoalInsight
   AI prompt: "Athlete has goal: {goal}. Current progress: {pct}%. 
   Weeks remaining: {n}. Are they on track? What's the critical path?"
   Returns: { on_track, message, critical_action, estimated_achievement_date }
   Cache: goal_{goal_id}_{YYYY-MM}, TTL: 168h

3. checkGoalMilestones(userId): Milestone[]
   Check if any 25/50/75/100% milestones were just crossed
   Return milestones to trigger celebrations

Mobile: add a Goals section to Progress screen
  - Active goal card with progress bar
  - "Na dobri poti 🟢" or "Pozor — zaostajate 🟡"  
  - AI insight sentence below
  - "Dodaj cilj" button → simple goal setup form
```

---

### 9. NOTIFIKACIJE — MOBILE SETUP

```
Read CLAUDE.md. Wire up the notification engine to the mobile app.

1. Update mobile/src/services/notifications.ts:
   - On app start: register push token and send to backend POST /notifications/register
   - Handle foreground notifications: show in-app banner (not system notification)
   - Handle background tap: deep link to correct screen

2. Create backend notification scheduler using Supabase Edge Functions:
   File: supabase/functions/notification-scheduler/index.ts
   
   Runs every 15 minutes via cron: */15 * * * *
   
   Checks:
   - Users who should receive morning readiness (07:15 check)
   - Users with workout scheduled in ~60 minutes
   - New PRs or FTP tests since last check
   - Weekly/monthly reviews ready to send
   - Inactivity checks
   
   For each notification to send:
   - Check anti-spam rules (notifications_sent table)
   - Check user's quiet hours preferences
   - Send via Expo Push API
   - Record in notifications_sent

3. Create mobile/src/screens/NotificationSettingsScreen.tsx:
   List of toggles for each notification category:
   
   ✓ Jutranja pripravljenost
   ✓ Opomniki za trening  
   ✓ Mejniki in rekordi
   ✓ Tedenski pregled
   ✓ Mesečni pregled
   ○ Spodbude za neaktivnost  (off by default — most sensitive)
   
   Quiet hours: time range picker (default 22:00–07:00)
   
   "Preizkusi obvestilo" button for each type — sends a test notification immediately.
```

---

### 10. COACH PERSONALITY CALIBRATION

```
Read CLAUDE.md. Allow users to calibrate the AI coach's communication style.

Add to user profile: coach_style preference
Options:
  'motivator':  enthusiastic, lots of encouragement, celebrates every win
  'scientist':  data-focused, explains the why, more analytical
  'minimalist': brief, to the point, no fluff

In buildCoachSystemPrompt(), add style instructions:

motivator:
  "You are energetic and enthusiastic. Use emojis sparingly but effectively.
   Celebrate every achievement genuinely. Use phrases like 'Odlično!', 'To je to!'.
   Make the athlete feel proud of their effort. Never skip a celebration."

scientist:
  "You are precise and analytical. Always explain the physiological reason
   behind every recommendation. Reference specific numbers (TSS, CTL, W/kg).
   Use phrases like 'Podatki kažejo...', 'Fiziološko gledano...'.
   The athlete wants to understand the why, not just the what."

minimalist:
  "Be extremely concise. Maximum 1-2 sentences per response.
   No emojis. No filler words. Direct recommendations only.
   The athlete values their time — respect it."

Add coach style selector to onboarding (step after profile setup):
  3 cards with preview of how coach would respond to the same situation
  Label: "Kakšen trener ti ustreza?"
  
  Motivator preview:   "Fenomenalno! 🔥 Danes si bil vrhunski. FTP narasel za 12W — trdega dela je vredno!"
  Scientist preview:   "FTP: +12W (+4.4%). CTL narasel na 74. Fiziološko ste v optimalni build fazi."
  Minimalist preview:  "FTP: 287W. Plan: Build faza, teden 5. Jutri: 90min Z2."
```

