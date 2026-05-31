# Kōda — MVP Brief

## What We're Building

Most cyclists train blind. They track rides on Strava, follow generic plans they found online, and wonder why they're not getting faster. A real coach would look at your data, your fatigue, your life — and tell you exactly what to do tomorrow. That coach costs $200/month. We're making that accessible to everyone.

Kōda is an AI cycling coach in your pocket. Connect your Strava, tell us your goal, and we'll handle the rest — a smart weekly plan that adjusts to how you actually feel, not how a spreadsheet thinks you should feel.

---

## The Problem Worth Solving

Real coaching is out of reach for most cyclists. Not because the knowledge doesn't exist — it does. But because a good coach needs time, data, and context that most people can't afford to provide. So cyclists guess. They overtrain, undertrain, burn out, plateau.

Strava has all the data. It just doesn't do anything with it.

---

## Our Answer

Connect Strava → get a plan built from your actual rides → rate each workout → watch the plan get smarter every week.

That's it. No complicated setup. No jargon. Just a coach that knows your numbers better than you do, and explains everything in plain English.

---

## What v1.0 Does

**Connect & Sync**
Link your Strava account and we pull everything — years of rides if you have them. Every new ride syncs automatically. Your history is the fuel our AI runs on.

**Your Weekly Plan**
Every Monday, your coach generates a fresh week of training. Not a template — a plan built around your current fitness, how tired you are, and what phase of the season you're in. Base, Build, Peak. The AI knows where you are and what you need next.

**Morning Check-in**
Five seconds every morning. One emoji. How do you feel today? That single input adjusts your entire day's workout. Push hard when you're fresh. Pull back when you're not. Simple.

**Post-Ride Feedback**
After every ride, a quick three-question check-in. How hard was it? Did you complete it? How do you feel now? This is how your plan gets smarter — real feedback, not just power numbers.

**Progress That Makes Sense**
FTP, form, fitness — translated into plain English. "You're in great shape today" beats "TSB: +12" every time. Numbers are still there if you want them. But they're never the headline.

**Notifications That Don't Annoy You**
Morning readiness. Weekly recap. A genuine celebration when you hit a new record. That's it. No spam. No guilt trips. No "you haven't trained in 3 days" messages.

---

## 6 Screens

| Screen | What it does |
|---|---|
| Onboarding | Sign up, set your goal, connect Strava |
| Dashboard | Today's form + this week's plan |
| Workout Detail | What to do and exactly why |
| Rides | Your synced Strava history |
| Progress | FTP, fitness, form — in plain language |
| Profile | Coach style, theme, settings |

---

## Stack

React Native · Node.js · Supabase · OpenAI · Strava API · Docker

---

## 6-Week Build

| Week | Focus |
|---|---|
| 1 | Project setup, Supabase schema, Strava OAuth |
| 2 | Full Strava sync, CTL/ATL/TSB from history |
| 3 | AI plan generator, phase engine, cache system |
| 4 | Dashboard, Plan screen, Workout detail |
| 5 | Morning check-in, post-workout survey |
| 6 | Notifications, polish, beta |

---

## What Good Looks Like

A user connects Strava and has their first plan in under 5 minutes. The plan feels personal — not generic. After two weeks, the plan has visibly adapted to their feedback. After a month, they're fitter and they know it.

---

## What We're Not Building Yet

No social features. No video. No Zwift integration. No web app. No nutrition plans. No billing. Ship the core loop first, validate it works, then layer on top.
