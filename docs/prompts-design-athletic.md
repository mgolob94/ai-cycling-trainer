# Claude Code Prompts — Design System (Strava-inspired)

Reference: Strava activity detail + statistics.
Philosophy: numbers are the heroes. Coaching is the context. Nothing decorative.
Font: Not Inter. Not Roboto. Something different.

---

## 0. DESIGN LANGUAGE (read before anything else)

```
Read CLAUDE.md and docs/ui-copy.md.

Before writing any code, internalize this design philosophy:

WHAT STRAVA DOES RIGHT (copy this):
- Big, unapologetic numbers — distance, power, time fill the full width
- Dark background on activity detail — data pops, nothing competes
- Orange only for achievements (PRs, records) — never as brand wallpaper
- Zero decoration — no gradients, no card shadows, no rounded corners on hero elements
- Typography does all the heavy lifting
- Stats in a clean grid — no labels fighting for attention

WHAT WE DO DIFFERENTLY (our edge):
- Strava shows data. We explain what it means.
- Strava has no coaching context. Every number we show has a "so what?"
- Our AI insight sits below the stats — never above, never competing

TONE OF DESIGN:
  Not: polished SaaS app
  Not: fitness startup with gradients
  Yes: athletic tool used by serious people
  Yes: editorial — like a sports magazine, not a dashboard
  Yes: confident — big type, strong contrast, no hedging

TYPOGRAPHY (critical — this is what makes it feel different):
  Display numbers:  'Barlow Condensed' weight 700-900, uppercase
  Body/labels:      'DM Sans' weight 400-500 (clean, not generic)
  Mono/data:        'JetBrains Mono' for live data values

  Why Barlow Condensed: it's athletic, condensed = fits big numbers,
  used by sports brands (not SaaS). Feels earned, not designed.

COLORS:
  Light mode:
    Background:     #F5F5F3    (warm off-white, not clinical white)
    Surface:        #FFFFFF
    Surface alt:    #EFEFED    (used instead of borders where possible)
    Text primary:   #111110    (near black, warm)
    Text secondary: #6B6B69
    Text dim:       #ADADAA
    Accent green:   #059669    (primary — use sparingly)
    Achievement:    #E8420A    (Strava-ish orange-red — ONLY for PRs, records)
    Border:         #E8E8E6
    Danger:         #DC2626

  Dark mode:
    Background:     #0A0A09    (true black, warm tint)
    Surface:        #141413
    Surface alt:    #1C1C1B
    Text primary:   #F0EFEB    (warm white)
    Text secondary: #787876
    Text dim:       #3A3A38
    Accent green:   #34D399
    Achievement:    #FF5733    (brighter orange for dark bg)
    Border:         #222221

SPACING: 4pt base grid. Content bleeds to edges on mobile.
No excessive padding. Data should feel dense but readable.

BORDERS: 1px solid #E8E8E6 (light) / #222221 (dark)
No border-radius on hero stats elements.
Subtle radius (6px) only on small badges and chips.

SHADOWS: None on cards. None on stats.
Only a subtle shadow on floating elements (modals, tooltips).
```

---

## 1. DESIGN TOKENS — NEW SYSTEM

```
Read CLAUDE.md. Replace mobile/src/theme/tokens.ts completely
with the new athletic design system.

export const LIGHT = {
  // Backgrounds
  bg:           '#F5F5F3',
  surface:      '#FFFFFF',
  surfaceAlt:   '#EFEFED',
  surfaceDark:  '#111110',   // for hero/achievement cards

  // Text
  textPrimary:  '#111110',
  textSecondary:'#6B6B69',
  textDim:      '#ADADAA',
  textInverse:  '#F0EFEB',

  // Brand
  green:        '#059669',
  greenLight:   '#ECFDF5',
  greenDim:     '#D1FAE5',

  // Achievement (use sparingly — PRs, records, milestones only)
  achievement:  '#E8420A',
  achievementBg:'#FFF0EB',

  // Status
  warning:      '#D97706',
  warningBg:    '#FFFBEB',
  danger:       '#DC2626',
  dangerBg:     '#FEF2F2',

  // Utility
  border:       '#E8E8E6',
  borderSubtle: '#F0EFEB',
}

export const DARK = {
  bg:           '#0A0A09',
  surface:      '#141413',
  surfaceAlt:   '#1C1C1B',
  surfaceDark:  '#0A0A09',

  textPrimary:  '#F0EFEB',
  textSecondary:'#787876',
  textDim:      '#3A3A38',
  textInverse:  '#111110',

  green:        '#34D399',
  greenLight:   'rgba(52,211,153,0.12)',
  greenDim:     'rgba(52,211,153,0.06)',

  achievement:  '#FF5733',
  achievementBg:'rgba(255,87,51,0.12)',

  warning:      '#FBBF24',
  warningBg:    'rgba(251,191,36,0.12)',
  danger:       '#F87171',
  dangerBg:     'rgba(248,113,113,0.12)',

  border:       '#222221',
  borderSubtle: '#1C1C1B',
}

export const FONTS = {
  display: 'BarlowCondensed',    // big numbers, headlines
  body:    'DMSans',             // everything else
  mono:    'JetBrainsMono',      // live data, code-like values
}

export const ZONE_COLORS = {
  z1: '#94A3B8',
  z2: '#60A5FA',
  z3: '#34D399',
  z4: '#FBBF24',
  z5: '#F97316',
  z6: '#EF4444',
  z7: '#A855F7',
}

Set up fonts in app.json using expo-font.
Load BarlowCondensed-Bold, BarlowCondensed-Black,
DMSans-Regular, DMSans-Medium, JetBrainsMono-Regular.
```

---

## 2. ACTIVITY DETAIL SCREEN — STRAVA INSPIRED

```
Read CLAUDE.md and docs/ui-copy.md.

Rebuild mobile/src/screens/RideDetailScreen.tsx from scratch.
This is the most important screen — make it feel like opening Strava
but with coaching context underneath.

LAYOUT (dark surface, no white card look):

──────────────────────────────────────────
HEADER (dark bg #111110 or #141413 dark mode)
  ← back    "Morning Ride"    •••
  Tuesday, 27 May · 2h 24min ago
──────────────────────────────────────────
HERO STATS (full bleed, no card)

  68.4          241          1,240
   KM           W NP          M ↑

  Text: BarlowCondensed-Black, 52px
  Labels: DMSans 11px uppercase, letterSpacing 0.08em, dim color
  Layout: 3 columns, equal width, center aligned
  Dividers: 1px vertical lines between columns

──────────────────────────────────────────
SECONDARY STATS (2 rows of 3)

  2:24:16    29.8 km/h    142 bpm
  TIME       AVG SPEED    HEART RATE

  1.04       8.2/10       342 kJ
  VI         AI SCORE     WORK

  Text: BarlowCondensed-Bold 26px
  Labels: DMSans 10px uppercase, dim
  Same grid, slightly smaller than hero

──────────────────────────────────────────
AI COACH INSIGHT (first coaching element)

  Thin separator line

  "COACH" label (11px uppercase, green)

  "Solid sweet spot effort. Power was even throughout —
   VI 1.04 shows excellent pacing discipline.
   One thing: the last 20 minutes dipped. Try holding
   that same effort all the way through next time."

  Text: DMSans 15px, textSecondary
  No card, no box — just text with green "COACH" prefix

──────────────────────────────────────────
ZONE DISTRIBUTION

  "TIME IN ZONES" label (11px uppercase, dim)

  Horizontal stacked bar — full width, 8px height, no border-radius
  Z1 ░░ Z2 ████████ Z3 ████████ Z4 ██████ Z5 ██ Z6 ░

  Below: zone labels with % and time
  Z2  34%  48min    Z3  28%  40min    Z4  22%  31min
  (only show zones with > 5% time)

──────────────────────────────────────────
HOW THIS FITS YOUR WEEK

  "WEEK CONTEXT" label (11px uppercase, dim)

  Progress bar: TSS this ride vs weekly target
  "88 TSS · 312 of 420 target this week  [████████░░]"

  One line: "Wednesday threshold session still ahead — this
  sets you up well for it."

──────────────────────────────────────────
ACHIEVEMENT (only if a PR exists)

  Full-width banner with achievement (#E8420A) bg
  "NEW RECORD  5-min power · 342W"
  BarlowCondensed-Black 22px, white text

──────────────────────────────────────────
TAB BAR

Use an actual icon library — no emoji.
Active tab: textPrimary color + 2px top border (green)
Inactive: textDim

All text in DMSans. All numbers in BarlowCondensed or JetBrainsMono.
Dark background persists through the whole screen — no white sections.
```

---

## 3. DASHBOARD SCREEN — REDESIGN

```
Read CLAUDE.md and docs/ui-copy.md.

Rebuild DashboardScreen.tsx. Athletic, not SaaS.

LAYOUT:

──────────────────────────────────────────
HEADER (no border, no shadow)
  "GOOD MORNING"  (DMSans 13px, textDim, uppercase)
  "Marcel"        (BarlowCondensed-Bold 32px, textPrimary)

  Right: avatar (32px circle, initials)
──────────────────────────────────────────
FORM CARD (surfaceDark bg — #111110 light / #141413 dark)

  Top row:
    Form label: "FORM" (10px uppercase, textDim)
    Status badge: right-aligned (green/amber/red chip)

  Big status text:
    "Optimal."   — BarlowCondensed-Black 42px, textInverse

  Sub:
    "You're ready to push today."  — DMSans 14px, textDim (50% opacity white)

  Scale bar (full width, 4px, no border-radius):
    Zones: red ── amber ── green ── green ── amber
    White dot indicator at current position

  Bottom row (3 stats, separated by 1px lines):
    74          62         +12
    FITNESS     FATIGUE    FORM
    BarlowCondensed-Bold 22px, textInverse

──────────────────────────────────────────
"THIS WEEK" header (11px uppercase, textDim)  +  "Full plan →" (green, 12px)

WORKOUT LIST (no cards — rows with left accent)

  Each workout:
    Left: 3px color bar (zone color)
    Content: day name (DMSans 13px bold) + workout title (DMSans 13px textSecondary)
    Right: duration chip + zone badge

  Today: full-width highlight — surfaceAlt bg, textPrimary
  Rest day: no accent bar, textDim

  No card shadow. No border-radius on rows.
  Rows separated by 1px borderSubtle lines.

──────────────────────────────────────────
MORNING CHECK-IN (bottom, subtle)

  Only shown 5:00–11:00 if no check-in today.

  "How are you feeling?"  (DMSans 13px, textSecondary)
  😴  😕  😐  😊  ⚡     (24px emoji, equal spacing)

  No card. No box. Just text + emoji on surfaceAlt bg.
  Dismissible with × (small, textDim).
```

---

## 4. PROGRESS SCREEN — REDESIGN

```
Read CLAUDE.md and docs/ui-copy.md.

Rebuild ProgressScreen.tsx. Data-dense, athletic.

LAYOUT:

──────────────────────────────────────────
HEADER
  "Progress"  BarlowCondensed-Bold 28px
  Right: Strava sync pill (green dot + "Synced 12m ago")

──────────────────────────────────────────
FTP HERO (dark surface, full width)

  Left column:
    287         (BarlowCondensed-Black 64px, textInverse)
    WATTS FTP   (10px uppercase, textDim)

  Right column:
    3.8         (BarlowCondensed-Bold 38px, green)
    W/KG        (10px uppercase, textDim)
    "Club cyclist"  (DMSans 12px, achievement color)

  Bottom: "+12W since last test · 4.4% improvement"
  DMSans 12px, green

  No rounded card look. Dark bg bleeds edge to edge.

──────────────────────────────────────────
FITNESS TRIAD (3 columns, full width, surfaceAlt bg)

  74           62           +12
  FITNESS      FATIGUE      FORM
  ↑ +6 / mo   ↑ this wk    ● Optimal

  BarlowCondensed-Bold 32px
  Labels: 10px uppercase, textDim
  Trend: 11px, green (positive) / achievement (negative)
  1px vertical dividers

──────────────────────────────────────────
TSS CHART — "TRAINING LOAD"  (11px label)

  8-week bar chart
  Bars: surfaceAlt color, no border-radius
  Current week: green fill
  Height represents TSS value
  Week labels below: T-7 T-6 ... T-1 NOW

  Tap bar → inline tooltip: "Wk of May 20 · 312 TSS"
  No modal, no sheet — tooltip appears above the tapped bar

──────────────────────────────────────────
PERSONAL RECORDS — "YOUR BESTS"  (11px label)

  Horizontal scroll, 3 visible:

  Each record:
    Value: BarlowCondensed-Bold 28px
    Label: 10px uppercase, textDim
    Date: 11px textDim

    All-time record: achievement color left border 3px
    New record: "NEW" chip (achievement color bg, white text, 9px)

──────────────────────────────────────────
No excessive padding. Everything feels data-dense.
Numbers dominate. Labels are small and dim.
The hierarchy: number first, label second, context third.
```

---

## 5. TYPOGRAPHY — FONT SETUP

```
Read CLAUDE.md. Set up custom fonts for the athletic design system.

Install via expo-font:

1. Barlow Condensed (Google Fonts or local assets):
   - BarlowCondensed-Bold (weight 700)
   - BarlowCondensed-Black (weight 900)
   Used for: all big numbers, hero stats, screen titles

2. DM Sans (Google Fonts):
   - DMSans-Regular (400)
   - DMSans-Medium (500)
   - DMSans-SemiBold (600)
   Used for: all body text, labels, descriptions

3. JetBrains Mono (Google Fonts):
   - JetBrainsMono-Regular
   Used for: live data, precise values, times

Create mobile/src/theme/typography.ts:

export const TYPE = {
  // Display — big numbers, heroes
  heroXL:    { fontFamily: 'BarlowCondensed-Black', fontSize: 64, letterSpacing: -1 },
  heroLG:    { fontFamily: 'BarlowCondensed-Black', fontSize: 52, letterSpacing: -0.5 },
  heroMD:    { fontFamily: 'BarlowCondensed-Bold',  fontSize: 32, letterSpacing: -0.3 },
  heroSM:    { fontFamily: 'BarlowCondensed-Bold',  fontSize: 24 },

  // Screen titles
  title:     { fontFamily: 'BarlowCondensed-Bold',  fontSize: 28, letterSpacing: -0.2 },
  subtitle:  { fontFamily: 'BarlowCondensed-Bold',  fontSize: 22 },

  // Body
  bodyLG:    { fontFamily: 'DMSans-Regular',  fontSize: 16, lineHeight: 24 },
  body:      { fontFamily: 'DMSans-Regular',  fontSize: 14, lineHeight: 21 },
  bodySM:    { fontFamily: 'DMSans-Regular',  fontSize: 13, lineHeight: 19 },

  // Labels (always uppercase in usage)
  label:     { fontFamily: 'DMSans-Medium',   fontSize: 11, letterSpacing: 0.7 },
  labelSM:   { fontFamily: 'DMSans-Medium',   fontSize: 10, letterSpacing: 0.8 },

  // Data
  data:      { fontFamily: 'JetBrainsMono-Regular', fontSize: 14 },
  dataSM:    { fontFamily: 'JetBrainsMono-Regular', fontSize: 12 },
}

Create a <Text> wrapper component that accepts a variant prop
and applies the correct style. Always use this, never raw RN Text.
```

---

## 6. UI COPY — TONE UPDATES

```
Read CLAUDE.md and docs/ui-copy.md.

Update all UI text in the app to match this tone:

RULES:
1. Numbers are always the headline — text supports them, never competes
2. Labels are UPPERCASE, short, max 2 words
3. Descriptions are conversational — like talking to a training partner
4. Achievements use energy — "New record." not "You have achieved a new personal record"
5. Empty states are direct — "No rides yet." not "You haven't logged any rides yet"
6. Errors are human — "Something broke. Try again." not "An error occurred"

SPECIFIC CHANGES:

Stats labels (always uppercase in UI):
  "FITNESS" not "Fitness (CTL)"
  "FATIGUE" not "ATL - Acute Training Load"
  "FORM" not "Training Stress Balance"
  "FTP" not "Functional Threshold Power"
  "NP" not "Normalized Power"

Achievement copy (use energy):
  "New record." (period, confident)
  "Best 5-min power ever."
  "Fastest climb."
  NOT: "You have set a new personal record for 5-minute power"

Coach insight copy (conversational, specific):
  "Solid effort. Power held well in the first hour — dropped off in the last 20 minutes. Next time, save a bit more for the finish."
  NOT: "Your power output was consistent during the initial phase but showed a decline in the final segment."

Form status (direct):
  "Optimal." (just the word, with a period)
  "Tired."
  "Ready to go."
  NOT: "Your current training stress balance indicates optimal readiness"

Phase labels (confident):
  "Base. Week 3 of 6."
  "Build phase."
  "Peak week."
  NOT: "You are currently in the base training phase"

Apply these changes throughout all screens.
Reference docs/ui-copy.md for the full copy guide.
```

---

## 7. ANIMATIONS — ATHLETIC, NOT PLAYFUL

```
Read CLAUDE.md. Define the animation philosophy and implement
key animations using react-native-reanimated.

PHILOSOPHY:
  Strava feels fast. Numbers appear with weight.
  No bouncy springs. No playful overshoot.
  Quick, confident, directional.

SPECIFIC ANIMATIONS:

1. Number count-up (hero stats on RideDetailScreen):
   - Duration: 600ms
   - Easing: easeOutQuart (fast start, smooth stop)
   - Numbers count from 0 to final value
   - All three hero stats start simultaneously
   - No bounce, no overshoot

2. Screen entrance (activity detail open):
   - Content slides up 20px + fades in
   - Duration: 250ms
   - Easing: easeOutCubic
   - Feels like content "settling into place"

3. Form status card:
   - Opacity 0 → 1, translateY 12 → 0
   - Duration: 300ms, delay 100ms after screen load
   - Scale dot indicator slides to position (spring: stiffness 200, damping 25)

4. Bar chart (TSS bars on Progress screen):
   - Bars grow from bottom (height 0 → final)
   - Staggered: each bar starts 40ms after the previous
   - Duration: 400ms per bar, easeOutQuart
   - Current week bar: slightly slower (500ms) — draws the eye

5. Achievement banner:
   - Slides down from top of RideDetail screen
   - Duration: 350ms, spring (stiffness 180, damping 20)
   - Small pulse animation on the PR value (scale 1 → 1.05 → 1)

6. Tab transitions:
   - Cross-fade only — no slide
   - Duration: 150ms
   - No transform — just opacity

WHAT WE DON'T DO:
  No confetti. No celebration particles.
  No continuous looping animations (except the sync spinner).
  No gesture-driven animations on stats screens.
  Everything resolves and stops — never loops, never floats.
```
