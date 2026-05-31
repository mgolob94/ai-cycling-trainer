# Claude Code Prompts — Onboarding Flow

Complete onboarding from zero to first plan.
6 steps. Under 3 minutes for the user.
No step is skippable except Strava (with warning).

---

## 0. BEFORE YOU START

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Read docs/ui-copy.md for all text — do not invent copy.
Read docs/prompts-design-athletic.md for design rules.

Key rules for this onboarding:
- Font: BarlowCondensed for headlines, DMSans for body
- Colors: tokens from mobile/src/theme/tokens.ts
- No card shadows, no heavy borders
- Every screen has ONE primary action
- Progress indicator at top (step X of 6)
- All copy from ui-copy.md — section: ONBOARDING
```

---

## 1. NAVIGATION SETUP

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create the onboarding navigation stack in mobile/src/navigation/index.tsx.

Logic:
- On app start: check Supabase auth session
- If no session → show Onboarding stack
- If session exists but onboarding_completed = false → show Onboarding stack
- If session + onboarding_completed = true → show Main tab bar

Add onboarding_completed (boolean, default false) to users table.
Set to true after Step 6 completes.

Onboarding stack screens (in order):
  1. WelcomeScreen
  2. SignUpScreen
  3. ProfileSetupScreen
  4. GoalSetupScreen
  5. CoachStyleScreen
  6. StravaConnectScreen

Main tab bar screens:
  Dashboard / Plan / Progress / Nutrition / Profile

Transition animation between onboarding screens:
  Slide left (forward), slide right (back)
  Duration: 250ms, easeOutCubic
  No back button on WelcomeScreen
  Back button on all others (top left, chevron-left icon)
```

---

## 2. WELCOME SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section ONBOARDING > Welcome screen.

Create mobile/src/screens/onboarding/WelcomeScreen.tsx.

LAYOUT (full screen, dark bg #111110):

  Top 60% — Visual area:
    Large "Kōda" wordmark center
    Font: BarlowCondensed-Black 64px, white
    Below: tagline from ui-copy.md
    Font: DMSans 17px, #787876

  Bottom 40% — Actions:
    Primary button: "Let's go"
      Full width, bg white, text #111110
      BarlowCondensed-Bold 18px
      Height: 52px, no border-radius (sharp corners)
      → navigates to SignUpScreen

    Secondary: "See a demo first"
      Ghost button, white text, DMSans 14px
      → loads MockData and enters app with demo banner

  Bottom text:
    "Already have an account? Sign in"
    DMSans 13px, #525250
    "Sign in" is tappable → goes to SignUpScreen with login tab active

No status bar content. Edge to edge.
No onboarding progress bar on this screen.
```

---

## 3. SIGN UP SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/screens/onboarding/SignUpScreen.tsx.

Two tabs at top: "Create account" | "Sign in"
Active tab: underline in green (#059669), BarlowCondensed-Bold 16px
Inactive: DMSans 15px, #6B6B69

SIGN UP TAB:
  Email input
    Label: "EMAIL" (uppercase, 10px, #6B6B69)
    Input: DMSans 16px, full width, bottom border only (1px #E8E8E6)
    No box/card around it
  
  Password input (same style)
    Show/hide toggle (eye icon, right side)
  
  Primary button: "Create account"
    Full width, bg #111110, white text
    BarlowCondensed-Bold 17px, height 52px

  Error states:
    Red text below field, DMSans 13px
    "That email is already registered."
    "Password must be at least 8 characters."

  On success:
    Create user in Supabase Auth
    Create users row with defaults
    Navigate to ProfileSetupScreen

SIGN IN TAB:
  Same fields
  Button: "Sign in"
  "Forgot password?" link below button
  On success → check onboarding_completed
    false → continue onboarding from last incomplete step
    true → go to main app

Progress indicator: Step 1 of 6 (top of screen, thin green line)
```

---

## 4. PROFILE SETUP SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section ONBOARDING > Profile setup.

Create mobile/src/screens/onboarding/ProfileSetupScreen.tsx.

Title: "Tell us about yourself"
BarlowCondensed-Bold 28px, #111110

Subtitle: DMSans 15px, #6B6B69

FIELDS:

1. Age (number input)
   Label: "AGE"
   Keyboard: numeric
   Placeholder: "32"

2. Weight (number input with unit toggle)
   Label: "WEIGHT"
   Toggle: kg / lbs (small pill toggle, right of label)
   Convert automatically when toggled

3. How many days per week can you ride?
   Label: "TRAINING DAYS / WEEK"
   Segmented control: 2  3  4  5  6
   Active: #111110 bg, white text
   Inactive: #EFEFED bg, #111110 text
   Default: 4

4. Preferred long ride day
   Label: "LONG RIDE DAY"
   Two options: SAT  SUN (same segmented style)
   Default: SAT

No dropdowns. No modals. Everything inline.

Validation:
  Age: 16–80
  Weight: 40–150 kg

Primary button: "Continue"
  Disabled until age + weight filled
  Full width, #111110, BarlowCondensed-Bold 17px

Progress: Step 2 of 6
```

---

## 5. GOAL SETUP SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section ONBOARDING > Goal setup.

Create mobile/src/screens/onboarding/GoalSetupScreen.tsx.

Title: "What are you training for?"
BarlowCondensed-Bold 28px

TWO OPTION CARDS (full width, tappable):

Card A — "I have a specific event"
  Icon: 🏁 (32px)
  Title: BarlowCondensed-Bold 20px
  Description: DMSans 14px, #6B6B69 (from ui-copy.md)
  Border: 1px #E8E8E6
  Selected state: border 2px #111110, subtle #EFEFED bg

Card B — "I want to get fitter"
  Icon: 📈 (32px)
  Same styling

If Card A selected → show event fields below (animated expand):
  Event name text input
    Label: "EVENT NAME"
    Placeholder: "Gran Fondo, race, sportif..."
  
  Event date picker
    Label: "EVENT DATE"
    Opens native date picker
    Validation: must be > 3 weeks from today
    Warning if < 3 weeks: "That's very soon — we'll focus on tapering."

If Card B → no additional fields

Primary button: "Continue"
  Always enabled (Card B selected by default)

Progress: Step 3 of 6
```

---

## 6. COACH STYLE SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section ONBOARDING > Coach style.

Create mobile/src/screens/onboarding/CoachStyleScreen.tsx.

Title: "How should your coach talk to you?"
BarlowCondensed-Bold 26px

THREE OPTION CARDS (vertical stack):

Each card shows:
  Style name: BarlowCondensed-Bold 20px
  Description: DMSans 14px, #6B6B69
  Preview quote: italic, DMSans 13px, #9B9B99
    — a real example of how coach would respond

Motivator card:
  Name: "Motivator"
  Description + preview from ui-copy.md

Scientist card:
  Name: "Scientist"
  Description + preview from ui-copy.md

Minimalist card:
  Name: "Minimalist"
  Description + preview from ui-copy.md

Selected card: left border 3px #111110, bg #FAFAF9
Default selected: Motivator

Save to users.coach_style on Continue.

Primary button: "Continue"

Progress: Step 4 of 6
```

---

## 7. KNOWLEDGE LEVEL SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/screens/onboarding/KnowledgeLevelScreen.tsx.

Title: "How familiar are you with cycling training?"
BarlowCondensed-Bold 24px

Subtitle: "We'll adjust how we show your data. You can change this anytime."
DMSans 14px, #6B6B69

THREE OPTION CARDS:

Beginner card:
  Icon: 🚴
  Title: "Just getting started"
  Sub: "Show me the essentials — no jargon"
  → knowledge_level = 'beginner'

Recreational card:
  Icon: 🚴‍♂️
  Title: "I ride regularly"
  Sub: "I know the basics, show me more"
  → knowledge_level = 'intermediate'

Experienced card:
  Icon: ⚡
  Title: "I know FTP, TSS, CTL..."
  Sub: "Give me all the data"
  → knowledge_level = 'advanced'

Below cards — live preview (updates on card tap):
  Small phone mockup (120px wide) showing how
  Dashboard form card looks for that level:
  
  Beginner:    "Optimal. You're ready to push today."
  Intermediate: "Optimal.  TSB: +12  ↑"
  Advanced:    "CTL: 74  ATL: 62  TSB: +12 — Optimal"

Default: Beginner
Save to users.knowledge_level.

Progress: Step 5 of 6
```

---

## 8. STRAVA CONNECT SCREEN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Text from docs/ui-copy.md section ONBOARDING > Connect Strava.

Create mobile/src/screens/onboarding/StravaConnectScreen.tsx.

This is the last onboarding step.
After Strava connects, initial sync starts in background
and user goes directly to Dashboard.

LAYOUT:

Top section:
  Strava logo (SVG, 48px)
  Title: "Connect your Strava"
  BarlowCondensed-Bold 28px
  
  Description from ui-copy.md
  DMSans 15px, #6B6B69

What we'll use (3 rows, icon + text):
  📍 Your ride history — to understand your fitness
  ⚡ Power data — to calculate your FTP
  📅 Activity sync — to keep your plan up to date
  
  DMSans 14px, #6B6B69
  Icons: Feather set, 16px, #059669

Primary button: "Connect Strava"
  Full width, bg #FC4C02 (Strava orange — only acceptable use here)
  White text, BarlowCondensed-Bold 17px
  → opens Strava OAuth via expo-web-browser

Skip link: "I'll do this later"
  DMSans 13px, #9B9B99, centered below button
  → shows warning modal:
    "Without Strava your plan will be less personalized.
     You can connect it anytime in Profile settings."
    Buttons: "Skip anyway" | "Connect Strava"

AFTER SUCCESSFUL OAUTH:
  Button changes to spinner briefly
  Then: "Syncing your rides..." with progress count
  Background: stravaSync.syncAllActivities() starts
  After 2 seconds regardless of sync status:
    → navigate to Dashboard
    → sync continues in background
    → Dashboard shows banner: "Importing your rides ({n}%)..."

Set users.onboarding_completed = true before navigating.

Progress: Step 6 of 6
  After connect: progress bar fills to 100% with green animation
```

---

## 9. DEMO MODE

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Read mobile/src/services/mockData.ts for mock data.

Implement demo mode triggered from WelcomeScreen "See a demo first" button.

On tap:
1. Load MockData into app state (no Supabase, no auth)
2. Navigate directly to Dashboard
3. Show persistent demo banner at TOP of every screen:

   ┌─────────────────────────────────────────────┐
   │  DEMO  Viewing sample data  Create account → │
   └─────────────────────────────────────────────┘
   
   Bg: #FFFBEB (amber-50)
   Text: DMSans 12px, #92400E
   "Create account →" tappable → goes to SignUpScreen
   NOT dismissible

4. Demo data:
   Name: "Alex" (neutral name)
   FTP: 271W, CTL: 68, ATL: 58, TSB: +10
   Form: "Optimal."
   This week: 4 workouts (Z2, threshold, rest, long ride)
   Last ride: 62km, NP 228W, AI score 7.8/10

5. All interactive elements work in demo:
   Tapping workouts, checking progress, viewing nutrition
   Post-workout survey shows but saves nothing
   Morning check-in shows but saves nothing

6. Anything that requires auth shows:
   "Create a free account to save your data →"
```

---

## 10. ONBOARDING COMPLETE — SUPABASE UPDATES

```
Read CLAUDE.md and docs/agents/AGENT-DB.md.

After all onboarding screens complete, ensure these fields
are saved to Supabase users table:

Required:
  age, weight_kg, available_days_per_week,
  preferred_long_ride_day, coach_style, knowledge_level,
  onboarding_completed = true

Optional (from GoalSetup):
  target_event_name, target_event_date (if event selected)
  goal = 'event' | 'fitness'

Save progressively — each screen saves its own data on Continue.
Don't wait until the end to save everything.
If user drops off mid-onboarding and returns:
  Resume from last incomplete step
  Pre-fill any already-saved fields

Create backend/src/routes/onboarding.js with:
  POST /onboarding/profile     — save profile fields
  POST /onboarding/goal        — save goal + event
  POST /onboarding/preferences — save coach_style + knowledge_level
  POST /onboarding/complete    — set onboarding_completed = true
                                 trigger first plan generation
```
