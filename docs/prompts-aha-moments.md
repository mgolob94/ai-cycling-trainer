# Claude Code Prompts — Aha Moments

The AI is already working. Users just can't see it.
These prompts make the value visible — turning invisible decisions into "wow" moments.

---

## 0. PHILOSOPHY

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Core principle for every prompt in this file:
  The AI already makes smart decisions. We just need to SHOW the reasoning.
  Every plan, every adaptation, every metric — explain WHY, not just WHAT.

The difference:
  Before: "This week: 4 workouts"
  After:  "4 workouts this week — lighter than usual because your
           fatigue spiked after Sunday's long ride. Wednesday is your
           key session. Don't skip it."

That second version is worth $14/month. The first isn't.

Never show a plan, a metric, or an adaptation without explaining
the reasoning behind it. Always answer: "Why does this look this way?"
```

---

## 1. AHA MOMENT #1 — FIRST SYNC REVEAL

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Read docs/ui-copy.md for tone.

This is the most important screen in the entire app.
It appears ONCE — after Strava sync completes for the first time.
It must make the user say "I didn't know this about myself."

Create mobile/src/screens/onboarding/FirstSyncRevealScreen.tsx

Triggered: after initial Strava sync completes (stravaSync.syncAllActivities done)
Duration: user stays as long as they want, then taps "Let's build your plan →"

LAYOUT — 3 cards the user swipes through:

CARD 1 — "Your engine"
  Dark bg (#111110)
  
  Top label: "BASED ON YOUR {n} RIDES"
  BarlowCondensed-Bold 14px, uppercase, #059669
  
  Big number reveal (animated count-up, 800ms):
  [FTP]W
  BarlowCondensed-Black 72px, white
  
  Below: W/kg value + rider category
  "3.8 W/kg · Serious amateur"
  BarlowCondensed-Bold 22px, #059669
  
  Context line:
  "That puts you ahead of roughly 70% of recreational cyclists."
  DMSans 14px, #787876
  
  If no power data (no power meter):
    Show estimated FTP from HR data instead
    Label: "ESTIMATED FROM HEART RATE DATA"

CARD 2 — "Your season so far"
  Timeline visual showing last 12 months of activity:
  
  Month labels across bottom: Jun Jul Aug Sep Oct Nov Dec Jan Feb Mar Apr May
  Bar per month: height = TSS that month
  Color: green bars, current month accent
  
  Below the chart — 3 stat bubbles:
  [total km]     [total elevation]    [total rides]
  "2,847 km"     "34,200 m"           "187 rides"
  BarlowCondensed-Bold 28px each
  
  Best month highlighted: amber border
  "Your best month: August — 342 TSS"
  
  Coach line:
  "You've been consistent. That's the hardest part — you've already done it."
  DMSans 14px, #787876

CARD 3 — "Your current fitness"
  CTL/ATL/TSB revealed with plain language:
  
  Big form status:
  "Good shape."  or  "Tired."  or  "Fresh."
  BarlowCondensed-Black 48px, white
  
  One sentence explaining what this means RIGHT NOW:
  "Your fitness has been building for 6 weeks straight.
   This is the best time to start a structured plan."
  DMSans 15px, #787876
  
  Small: "Fitness: 68  Fatigue: 55  Form: +13"
  (numbers small and secondary — context is primary)
  
  CTA button: "Build my first plan →"
  Full width, white bg, #111110 text
  BarlowCondensed-Bold 17px

Swipe indicator: 3 dots at bottom (card 1/2/3)
Skip link: "Skip to my plan" (small, #525250, top right from card 1)

This screen sets the tone for everything. Make it feel like a coach
who just reviewed your training log and is ready to work with you.
```

---

## 2. AHA MOMENT #2 — WHY YOUR PLAN LOOKS LIKE THIS

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update backend/src/services/aiCoach.js generateWeeklyPlan()
to always include explicit reasoning for the plan structure.

Add to the AI prompt:
"After generating the workouts array, also generate a 'reasoning' object
that explains WHY this plan looks the way it does.
This reasoning is shown to the user — make it feel personal and specific.
Reference actual numbers. Never be generic."

Add to plan JSON output:
{
  ...existing fields,
  reasoning: {
    headline: string,      // one punchy sentence: "Lighter week — your body earned it."
    bullets: string[],     // 2-4 specific reasons, each starting with "→"
    key_workout: {
      day: string,
      why: string          // why THIS is the most important workout this week
    },
    what_to_expect: string // one sentence: what adaptation this week builds
  }
}

Reasoning examples (tone reference):
  headline: "Building on last week's strong effort."
  bullets:
    "→ Your fitness (CTL: 74) has grown 8 points this month — on track."
    "→ Fatigue is moderate after Sunday's ride — Wednesday works best for intensity."
    "→ Friday is intentionally easy. That's where this week's adaptation happens."
    "→ Sunday's long ride sets up next week's build phase."
  key_workout:
    day: "Wednesday"
    why: "45 minutes at threshold. This is the session that moves your FTP."
  what_to_expect:
    "By Friday you'll feel the fatigue. That's the signal it's working."

Update training_plans table:
  Add reasoning (jsonb) column.
  Store generated reasoning alongside workouts.

Cache: reasoning is part of the plan cache — same TTL, same invalidation rules.
```

---

## 3. AHA MOMENT #2 — PLAN REASONING UI

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update mobile/src/screens/PlanScreen.tsx to show plan reasoning
prominently at the top of the weekly plan view.

Replace the current coach_intro card with a new PlanReasoningCard component.
Create mobile/src/components/plan/PlanReasoningCard.tsx

Props: reasoning (from training_plans.reasoning)

LAYOUT (surfaceDark bg — dark card):

  Top row:
    Left: "WHY THIS WEEK" label (10px uppercase, #059669)
    Right: cached timestamp (10px, #525250) + refresh icon

  Headline:
    reasoning.headline
    BarlowCondensed-Bold 22px, white
    e.g. "Building on last week's strong effort."

  Bullets (2-4 items):
    Each bullet: "→ [text]"
    "→" in #059669, rest in #787876
    DMSans 14px, lineHeight 22
    Spacing between bullets: 6px

  Divider (1px, #222221)

  Key workout highlight:
    "KEY SESSION THIS WEEK"  (10px uppercase, #059669)
    "[day] — [why]"
    DMSans 14px, white 80%
    e.g. "Wednesday — 45 minutes at threshold. This is the session that moves your FTP."

  What to expect (collapsed by default, tap to expand):
    "↓ What to expect this week"  (DMSans 13px, #525250)
    Expands to: reasoning.what_to_expect
    DMSans 14px, #787876 italic

Tap on any bullet → opens MetricTooltip for the relevant metric
(e.g. "CTL: 74" in a bullet → tap opens CTL explanation)

This card appears at the TOP of the plan screen, before the workout list.
It answers "why" before the user even sees "what."
```

---

## 4. AHA MOMENT #3 — ADAPTIVE PLAN NOTIFICATION

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

When the plan adapts (due to recovery, missed workouts, or availability change),
show a clear explanation — not just a silent update.

Update mobile/src/screens/PlanScreen.tsx:

When planAdaptation.reshuffleForAvailability() or adaptForRecovery() runs:
  Show a one-time dismissible banner at TOP of plan screen:

  ┌────────────────────────────────────────────────┐
  │  Plan updated  ·  Here's why          [Got it] │
  │  "Your fatigue spiked after yesterday's ride.  │
  │   Today's threshold session moved to Thursday  │
  │   and the intensity is dialled back slightly." │
  └────────────────────────────────────────────────┘

  Bg: #1C1C1B (dark surface)
  Border-left: 3px #059669
  Title: DMSans-SemiBold 13px, white
  Body: DMSans 13px, #787876
  "Got it" tap → dismisses and marks as seen

  Never show more than one adaptation banner at a time.
  If multiple adaptations: combine into one message.

Store adaptation reason in training_plans:
  Add adaptation_reason (text) column
  Set when plan is adapted: plain English explanation
  Cleared after user dismisses the banner

Create backend route: GET /plan/adaptation-status
  Returns: { adapted: boolean, reason: string | null }
  Mobile polls this when screen focuses (not on interval)
```

---

## 5. AHA MOMENT #4 — POST-WORKOUT INSIGHT

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update backend/src/services/rideFeedback.js generateRideFeedback()
to include a "progress signal" — something the user didn't know.

Add to AI prompt:
"Look for ONE positive signal in this ride data that the athlete
might not have noticed themselves. Something specific and data-driven.
Not generic praise — a genuine observation from the numbers.

Examples of good progress signals:
  'Your power in the final 20 minutes was 6% higher than your average
   for this type of ride — a clear sign your fitness is building.'
  
  'Heart rate was 4 bpm lower than your last threshold session at
   the same power — your aerobic engine is getting more efficient.'
  
  'You held 94% of FTP for 42 minutes. Six months ago your best was 35 minutes.'

If no positive signal exists (bad ride, skipped, illness): skip this field.
Return null and focus only on recovery advice."

Add progress_signal (string | null) to workout_feedback table.

Update RideDetailScreen — after coach feedback, add:

  If progress_signal exists:
  ┌────────────────────────────────────────────────┐
  │  📈  PROGRESS SIGNAL                           │
  │  "Your power in the final 20 minutes was 6%    │
  │   higher than your average — fitness building."│
  └────────────────────────────────────────────────┘
  
  Bg: greenLight (#ECFDF5 light / rgba(52,211,153,0.08) dark)
  Border-left: 3px #059669
  Label: "PROGRESS SIGNAL" 10px uppercase, #059669
  Text: DMSans 14px, textPrimary
  
  This is the moment that makes users think:
  "The app actually noticed something I didn't."
```

---

## 6. AHA MOMENT #5 — MONTHLY PROGRESS REVEAL

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

After 4 weeks of using the app, show a "Month 1 Progress" screen.
This fires ONCE — when the user completes their 4th week with the app.

Trigger: 28 days after onboarding_completed = true AND at least 8 rides synced.

Create mobile/src/screens/MonthProgressScreen.tsx
Shown as a modal over Dashboard (full screen, dismissible).

LAYOUT:

Header (dark bg):
  "4 WEEKS IN" label (#059669, uppercase)
  BarlowCondensed-Black 36px, white: "Here's what changed."

Comparison cards (3 cards, swipeable):

CARD 1 — Fitness:
  Two columns: WEEK 1 vs NOW
  
  CTL: "52" → "61"    (animated slide from left/right)
  "+9 points"  in #059669
  
  "That's 9 weeks of consistent training worth of fitness gain."
  DMSans 13px, #787876

CARD 2 — Consistency:
  "You rode [n] times in 4 weeks."
  Big number: BarlowCondensed-Black 64px
  
  "That's [pct]% of your planned workouts completed."
  Progress ring visual (SVG, green fill)
  
  Comparison: "vs. 4 weeks before you started: [previous_n] rides"
  (if Strava has historical data)

CARD 3 — Your best moment:
  Show the ride with highest TSS or a new PR achieved this month
  
  "Your best ride this month:"
  Ride title, date, key stat
  
  Coach message (AI generated, 1-2 sentences):
  Personal, specific, forward-looking.
  "The threshold work is starting to show. Next month, we push harder."

Bottom CTA:
  "Keep going →" — dismisses modal, goes to Dashboard
  Small: "Share my progress" — native share sheet with summary image

Generate this content in backend via POST /progress/monthly-reveal
Cache in ai_analysis_cache: monthly_reveal_{user_id}_{month_number}
TTL: permanent (it's a historical snapshot)
```

---

## 7. DASHBOARD — DAILY "WHY TODAY MATTERS"

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Add a "Today's context" line to the Dashboard that explains
why today's workout is important in the bigger picture.

This is different from the workout description — it's the COACHING CONTEXT.

Create backend/src/services/dailyContext.js

Function: getDailyContext(userId, today):
  Looks at: today's workout type, position in week, phase, TSB, CTL trend
  Returns one sentence that explains today in context of the plan

Examples:
  "Today's Z2 ride builds the aerobic base that makes Wednesday's intervals possible."
  "Rest day — your body is processing last week's load. This is where fitness is made."
  "Key session today. Your form is at +12 — best conditions you'll have this week."
  "Easy day before tomorrow's hard effort. Keep it genuinely easy."
  "Final hard day of the Build phase. Make it count — recovery week starts Monday."

NOT:
  "Today's workout is a Zone 2 endurance ride of 90 minutes."
  (That's description, not context.)

Cache: daily_{user_id}_{YYYY-MM-DD}, TTL: 24h

Update DashboardScreen — below the today's workout card:
  One line in DMSans 13px, textSecondary, italic
  No label, no icon — just the sentence
  
  e.g. below "Wednesday · Threshold intervals · 75 min":
  "Key session today. Your form is at +12 — best conditions you'll have this week."

This is the coach's voice on the dashboard. One sentence, every day.
It makes the app feel like someone is paying attention.
```

---

## 8. STRAVA SYNC — "WHAT WE LEARNED" SUMMARY

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

After every incremental Strava sync that finds new activities,
show a brief "what we learned from this ride" summary.

Triggered: after stravaSync.syncNewActivities() completes with new_activities > 0

Create mobile/src/components/sync/SyncInsightBanner.tsx

Shows as a temporary banner at TOP of Dashboard (not a notification):
  Duration: visible for 8 seconds or until dismissed
  Entrance: slides down from top (200ms spring)
  Exit: fades out (300ms)

Content (generated by backend):
  POST /rides/{strava_id}/quick-insight
  Returns 1-sentence insight generated from the new ride:
  
  "68km this morning — that's your longest ride in 6 weeks. Plan goes up next week."
  "Hard effort yesterday pushed your fatigue to 71. Today's easy ride is perfect timing."
  "Solid threshold session. Power was right where it needed to be."
  "Short one today — no problem. Consistency over perfection."

If multiple new rides (bulk sync):
  Show summary: "3 new rides synced · Fitness updated · Plan adjusted if needed."
  No individual ride insight for bulk syncs.

Layout:
  Left: green dot (pulsing, 2 cycles then stops)
  Text: DMSans 14px, textPrimary
  Right: "×" dismiss
  Bg: surface (#FFFFFF light / #141413 dark)
  Border-bottom: 1px border
  No shadow

Cache: sync_insight_{strava_activity_id}, TTL: permanent
Only generate once per ride — never regenerate.
```
