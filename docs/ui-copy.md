# Kōda — UI Copy Guide

The voice of Kōda is a training partner who happens to know a lot about sports science.
Direct. Warm. Never preachy. Celebrates genuinely. Never guilt trips.

---

## ONBOARDING

**Welcome screen**
Headline: "Your rides. Your data. Your coach."
Sub: "Kōda builds a training plan around how you actually ride — not a template."
CTA: "Let's go"
Secondary: "See a demo first"

**Connect Strava**
Headline: "Connect your Strava"
Sub: "We'll pull your ride history and use it to build your first plan. The more rides you have, the smarter your coach gets."
CTA: "Connect Strava"
Skip: "I'll do this later"

**Profile setup**
Title: "Tell us about yourself"
Fields: Age · Weight · How many days a week can you ride?

**Goal setup**
Title: "What are you training for?"
Option A icon: 🏁 "I have a specific event"
Option A sub: "Gran Fondo, race, sportif — give us a date and we'll build backwards from it"
Option B icon: 📈 "I want to get fitter"
Option B sub: "No event? No problem. We'll progress you through the season automatically."

**Coach style**
Title: "How should your coach talk to you?"
Motivator: "High energy. Lots of encouragement. Celebrates every win."
Scientist: "Data-first. Always explains the why. References your numbers."
Minimalist: "Short and sharp. No filler. Just what you need to know."

**All done**
Headline: "You're set up."
Sub: "Your first plan is ready. We built it around your Strava history — check it out."
CTA: "See my plan"

---

## DASHBOARD

**Greeting (morning)**
"Good morning, {name}."
"Good afternoon, {name}."

**Form status labels**
Peak form: "You're flying right now."
Optimal: "Good shape. Make the most of it."
Moderate: "A bit tired. Train smart today."
Fatigued: "Your body needs a break."
Overreached: "Rest today. No exceptions."

**Form sub-labels**
Peak form: "Best conditions for a hard effort or long ride"
Optimal: "Train as planned — you're ready"
Moderate: "Drop the intensity by one zone"
Fatigued: "Easy spin or full rest"
Overreached: "Two days minimum. Sleep and eat well."

**Week section header:** "This week"
**See all link:** "Full plan →"

**Workout card — today**
Badge: "Today"
If no workout: "Rest day. You've earned it."

**Strava sync banner**
"New ride synced · {distance}km, {power}W avg"
Stale banner: "Connect Strava to get your first plan →"

---

## TRAINING PLAN

**Phase labels**
base:     "Base · Week {n} of {total}"
build:    "Build · Week {n} of {total}"
peak:     "Peak · Week {n} of {total}"
recovery: "Recovery week"
taper:    "{n} days to {event}"

**Phase descriptions (shown on phase transition)**
base:     "Building the engine. Long, steady rides. No heroics."
build:    "Time to push. Threshold work starts here."
peak:     "Sharp and ready. This is what the base was for."
recovery: "Intentionally easy. Adaptation happens when you rest."
taper:    "Volume down, intensity stays. Arrive fresh."

**Coach intro examples (tone reference)**
Good: "Big week ahead — you've got the fitness for it. Wednesday is the key session. Nail that and the rest falls into place."
Good: "Recovery week. We know it feels too easy. That's the point. Trust the process."
Bad: "This week's training plan has been generated based on your current CTL/ATL/TSB values and periodization phase."

**Workout titles (human, not robotic)**
Good: "Long easy ride", "Threshold intervals", "Sweet spot", "Active recovery spin", "VO2max efforts", "Rest day"
Bad: "Zone 2 Endurance Training Session", "Aerobic Base Development Ride"

**Key workout badge:** "Key workout this week ★"

**History section header:** "Recent weeks"
Empty state: "Your history will build up here as you train."

---

## PROGRESS

**FTP card**
Value label: "Your FTP"
Improvement: "+{n}W since last test · {pct}% up"
No change: "Tested {n} weeks ago"
Category labels:
  < 2.0 W/kg: "Getting started"
  2.0–3.0:    "Recreational rider"
  3.0–4.0:    "Club cyclist"
  4.0–5.0:    "Serious amateur"
  > 5.0:      "Elite level"

**Fitness triad**
CTL label: "Fitness"
ATL label: "Fatigue"
TSB label: "Form"

**CTL interpretations**
< 30:   "Early days. Keep showing up."
30–50:  "Solid base. Consistency is working."
50–70:  "Good fitness. You're doing real training."
70–90:  "Strong. This is serious amateur territory."
> 90:   "Elite-level training load."

**TSS chart label:** "Training load — last 8 weeks"
**Current week bar tooltip:** "This week · {tss} TSS"

**Personal records section header:** "Your bests"
New PR badge: "New record"
Gold PR: "All-time best"

---

## RECOVERY

**Score labels**
85–100: "Ready to go."
70–84:  "Good to train."
50–69:  "Take it steady."
30–49:  "Light day."
0–29:   "Rest."

**Morning check-in**
Prompt: "How are you feeling this morning?"
Options: 😴 Wrecked · 😕 Tired · 😐 OK · 😊 Good · ⚡ Great
Skip: "Skip for today"

**Post-workout survey**
Q1: "How did the workout go?"
Options: "Nailed it" · "Mostly done" · "Cut it short" · "Skipped"

Q2: "How hard was it?"
Options: 😴 Too easy · 😊 About right · 😤 Hard · 💀 Too much

Q3: "How do you feel now?"
Options: "Fresh" · "Normal" · "Tired"

---

## NOTIFICATIONS

**Morning readiness**
Peak:     "Flying today ⚡ — perfect day to go hard"
Optimal:  "Good shape today 🟢 — train as planned"
Moderate: "A bit tired 🟡 — dial it back a notch"
Fatigued: "Take it easy today 🟠 — light or rest"
Rest:     "Rest day 🔴 — your body is asking for it"

**Milestones**
New PR:          "New record. {duration} power: {value}W 🏆"
FTP increase:    "FTP up to {value}W (+{change}W). The work is paying off 💪"
Consistency:     "7 days straight 🔥 This kind of consistency builds champions."
CTL milestone:   "Fitness just crossed {value}. That's serious amateur territory 🎖️"
First century:   "{distance}km. First century done 🎉"

**Weekly recap (Sunday)**
Good week:    "Strong week — {tss} TSS, {distance}km. {week_label} 📊"
Tough week:   "Tough week behind you. Recovery is training too. See you Monday."

**Inactivity (max 1x / 3 weeks, never guilt)**
"Hey {name} — whenever you're ready, your plan is here 🚴"

**Phase transition**
base → build:   "Base phase done 💪 Build phase starts this week — time to push."
build → peak:   "Fitness is high ⚡ Peak phase. {n} weeks to go."
taper start:    "{event} is {n} days away. Tapering starts now — easy does it 🏁"

---

## EMPTY STATES

No Strava connected: "Connect Strava to get your first plan. Takes 30 seconds."
No rides yet: "Your rides will appear here once Strava syncs."
No plan yet: "Your first plan is being built. Give it a moment."
No PRs yet: "Your personal records will show up after your first few rides."
No recovery data: "Tell us how you feel each morning and we'll factor it into your plan."

---

## ERRORS

Strava sync failed: "Couldn't reach Strava. Check your connection and try again."
Plan generation failed: "Something went wrong building your plan. Tap to retry."
Generic error: "That didn't work. Try again — if it keeps happening, let us know."

---

## TOOLTIPS (metric explanations)

FTP: "The maximum power you can hold for an hour. Your engine size. Higher = faster."
CTL (Fitness): "How fit you are right now. Builds slowly over months. Drops slowly too."
ATL (Fatigue): "How tired your legs are. Spikes after hard weeks. Recovers in days."
TSB (Form): "Fitness minus fatigue. Positive = fresh. Negative = tired. Sweet spot is +5 to +15."
TSS: "How hard a ride was overall — combines time and intensity. 100 TSS = one hour at your limit."
NP: "A smarter measure of effort than average power. Accounts for surges and climbs."
W/kg: "Power relative to your weight. The number that matters most on climbs."
