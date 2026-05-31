# Claude Code Prompts — Data Clarity & Legends

Every number in the app must make sense without prior knowledge.
No metric shown without context. No jargon without explanation.
These prompts fix the biggest UX gap before App Store launch.

---

## 0. BEFORE YOU START

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.
Read docs/ui-copy.md for tone reference.

Core rule for this entire feature:
- Every metric shown = context shown alongside it
- Context = plain English + visual range indicator
- Never show a raw number alone (TSS, CTL, ATL, TSB, FTP, W/kg)
- Ranges must feel earned, not random
- Tooltips appear on first encounter only — never spam
```

---

## 1. METRIC CONTEXT ENGINE

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/services/metricContext.ts
Single source of truth for all metric explanations and ranges.

Export this object:

export const METRIC_CONTEXT = {

  tss: {
    name: "Training Stress",
    short: "How hard this ride was overall.",
    analogy: "Think of it as the 'cost' of a ride. 100 = one hour at your absolute limit.",
    ranges: [
      { max: 50,  label: "Light",    color: 'z1', description: "Easy spin. Low cost." },
      { max: 100, label: "Moderate", color: 'z2', description: "Solid workout. Body notices." },
      { max: 150, label: "Hard",     color: 'z4', description: "Demanding. Plan recovery." },
      { max: 200, label: "Very hard",color: 'z5', description: "Big effort. Rest tomorrow." },
      { max: 999, label: "Extreme",  color: 'z6', description: "Max day. 2 days recovery." },
    ],
    weeklyRanges: [
      { max: 150,  label: "Easy week",    description: "Good for recovery or beginners." },
      { max: 300,  label: "Normal week",  description: "Solid training stimulus." },
      { max: 450,  label: "Big week",     description: "Meaningful load. Rest day needed." },
      { max: 600,  label: "Heavy week",   description: "High load. Monitor fatigue closely." },
      { max: 9999, label: "Max week",     description: "Only sustainable short-term." },
    ],
  },

  ctl: {
    name: "Fitness",
    short: "Your long-term training fitness. Builds over months.",
    analogy: "Think of it as how full your 'fitness bank' is. Fills slowly, empties slowly.",
    unit: "points",
    ranges: [
      { max: 20,  label: "Getting started",  description: "You're building the habit. Keep showing up." },
      { max: 40,  label: "Building base",    description: "Consistency is working. Base is forming." },
      { max: 60,  label: "Solid fitness",    description: "Good aerobic foundation." },
      { max: 80,  label: "Strong amateur",   description: "Serious training. Visible results." },
      { max: 100, label: "Dedicated athlete",description: "High fitness. Hard to maintain." },
      { max: 999, label: "Elite level",      description: "Professional training load." },
    ],
    weeklyGrowthNote: "Healthy growth: 3–6 points per week. More than 10/week risks injury.",
  },

  atl: {
    name: "Fatigue",
    short: "How tired your legs are right now. Changes quickly.",
    analogy: "Like a fuel gauge for your legs. Drains with hard training, refills with rest.",
    unit: "points",
    ranges: [
      { max: 20,  label: "Fresh",       description: "Legs are rested. Ready to push." },
      { max: 40,  label: "Moderate",    description: "Normal training fatigue." },
      { max: 60,  label: "Tired",       description: "Body is working hard. Rest soon." },
      { max: 999, label: "Very tired",  description: "Reduce load or take a day off." },
    ],
  },

  tsb: {
    name: "Form",
    short: "Your fitness minus your fatigue. Tells you if you're ready.",
    analogy: "Positive = fresh and ready. Negative = tired. Sweet spot for racing: +5 to +20.",
    unit: "",
    ranges: [
      { min: -999, max: -25, label: "Overtrained",   color: 'danger',  description: "Too much load. Rest now — no exceptions." },
      { min: -25,  max: -10, label: "Tired",          color: 'warning', description: "Heavy legs. Train easy or rest." },
      { min: -10,  max: 5,   label: "Optimal",        color: 'green',   description: "Best zone for training adaptation." },
      { min: 5,    max: 20,  label: "Fresh",           color: 'green',   description: "Ready for hard efforts or racing." },
      { min: 20,   max: 999, label: "Very fresh",      color: 'warning', description: "Well rested — maybe too little training?" },
    ],
    raceTarget: "For your best performance at an event, aim for TSB between +5 and +20.",
  },

  ftp: {
    name: "FTP — Threshold Power",
    short: "The maximum power you can hold for one hour.",
    analogy: "Your engine size. Higher FTP = faster at the same effort.",
    unit: "W",
    wkgRanges: [
      { max: 2.0,  label: "Getting started",  description: "Focus on consistency and base miles." },
      { max: 2.5,  label: "Recreational",     description: "Good foundation. Room to grow." },
      { max: 3.0,  label: "Fitness cyclist",  description: "Solid fitness. Competitive in local rides." },
      { max: 3.5,  label: "Club cyclist",     description: "Strong. Competitive in group rides." },
      { max: 4.0,  label: "Serious amateur",  description: "Very strong. Cat 4-3 race territory." },
      { max: 4.5,  label: "Advanced amateur", description: "Elite amateur. Cat 2-1 territory." },
      { max: 5.0,  label: "Semi-pro",         description: "Near professional level." },
      { max: 999,  label: "Professional",     description: "World Tour level." },
    ],
  },

  np: {
    name: "Normalized Power",
    short: "A smarter measure of effort than average power.",
    analogy: "Average power lies — it ignores surges and climbs. NP tells the real story.",
    unit: "W",
  },

  vi: {
    name: "Variability Index",
    short: "How steady your power was throughout the ride.",
    analogy: "1.00 = perfectly smooth. 1.10 = very variable. Lower is better for long rides.",
    unit: "",
    ranges: [
      { max: 1.02, label: "Very steady",  description: "Excellent pacing. Very efficient." },
      { max: 1.05, label: "Steady",       description: "Good pacing discipline." },
      { max: 1.10, label: "Variable",     description: "Some surges. Normal for outdoor rides." },
      { max: 999,  label: "Very variable",description: "Lots of surges. High physiological cost." },
    ],
  },

  recovery: {
    name: "Recovery Score",
    short: "How ready your body is to train today.",
    analogy: "Like a battery charge. 100% = fully charged. 20% = needs charging.",
    unit: "",
    ranges: [
      { max: 30,  label: "Rest",     color: 'danger',  description: "Body is asking for a day off." },
      { max: 50,  label: "Easy",     color: 'warning', description: "Light activity only." },
      { max: 70,  label: "Moderate", color: 'warning', description: "Train but dial back intensity." },
      { max: 85,  label: "Good",     color: 'green',   description: "Train as planned." },
      { max: 100, label: "Optimal",  color: 'green',   description: "Best conditions to push hard." },
    ],
  },
}

// Helper: get range label for a metric + value
export function getRange(metric: keyof typeof METRIC_CONTEXT, value: number) {
  const m = METRIC_CONTEXT[metric]
  if (!m.ranges) return null
  return m.ranges.find(r => value <= (r.max ?? 999) && value >= (r.min ?? -999))
}

// Helper: get W/kg range label
export function getWkgRange(wkg: number) {
  return METRIC_CONTEXT.ftp.wkgRanges.find(r => wkg <= r.max)
}
```

---

## 2. METRIC BADGE COMPONENT

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/components/metrics/MetricBadge.tsx
A small contextual label shown next to every metric value.

Props:
  metric: keyof typeof METRIC_CONTEXT
  value: number
  showLabel?: boolean    // default true
  showBar?: boolean      // default false — small range indicator

Renders:
  [value]  [range label]

Example outputs:
  "88"  "Hard"          ← TSS 88
  "74"  "Solid fitness" ← CTL 74  
  "+12" "Fresh"         ← TSB +12
  "287W" "Serious amateur"  ← FTP with W/kg label

Label styles:
  Light bg tinted to zone color (from ZONE_COLORS or status colors)
  DMSans-Medium 11px, uppercase, letterSpacing 0.5
  Padding: 2px 6px, borderRadius 4
  No border

When showBar=true:
  Adds a tiny 3px horizontal bar below the value
  Bar shows position in range (like a mini progress bar)
  Width: 40px, filled to % of position in range
  Color: same as range color

Usage: place MetricBadge next to every StatCard value in:
  - RideDetailScreen (TSS, NP, VI)
  - ProgressScreen (CTL, ATL, TSB, FTP)
  - DashboardScreen (form card CTL/ATL/TSB)
```

---

## 3. CONTEXT TOOLTIP — REDESIGN

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update mobile/src/components/metrics/MetricTooltip.tsx
Use METRIC_CONTEXT as the data source for all explanations.

Bottom sheet layout (height: auto, max 60% screen):

Header:
  Metric name: BarlowCondensed-Bold 24px
  Short description: DMSans 15px, textSecondary
  Dismiss handle at top

Analogy card (surfaceAlt bg):
  "💡" + analogy text
  DMSans 14px, slightly indented
  This is the most important element — make it prominent

Range table:
  "YOUR CURRENT VALUE" label (uppercase, 10px, dim)
  Current value highlighted with range label + color
  
  Divider
  
  "REFERENCE RANGES" label
  Table of all ranges:
  ● Getting started   0–20
  ● Building base     20–40
  ▶ Solid fitness     40–60  ← current highlighted with arrow
  ● Strong amateur    60–80
  
  Range rows: DMSans 13px
  Current row: textPrimary + left arrow indicator
  Other rows: textSecondary

Weekly note (if applicable, e.g. CTL growth note):
  Small italic note at bottom
  DMSans 12px, textDim

"Got it" button — closes sheet
  Full width, surface bg, border 1px
  No primary color — this is a learn action, not a CTA
```

---

## 4. FIRST-ENCOUNTER TOOLTIPS

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create mobile/src/services/tooltipTrigger.ts
Shows a one-time contextual hint the FIRST time a user sees each metric.

Storage: AsyncStorage key 'seen_tooltips': string[] (list of metric keys)

Function: shouldShowFirstEncounter(metric: string): boolean
  Returns true only if metric NOT in seen_tooltips
  After showing: add to seen_tooltips array

Function: markAsSeen(metric: string): void

Create mobile/src/components/metrics/FirstEncounterHint.tsx
A subtle animated hint that appears below a metric for 4 seconds
on first encounter, then auto-dismisses.

Props: metric, value

Visual:
  Small floating tooltip-style hint (NOT a modal, NOT a sheet)
  Appears below the metric with a subtle up-pointing triangle
  
  Content: one sentence from METRIC_CONTEXT[metric].short
  + "Tap ⓘ to learn more"
  
  Bg: #111110 (dark, stands out)
  Text: white, DMSans 12px
  Max width: 200px
  Border radius: 6px
  
  Entrance: fade in + slide up 6px (200ms)
  Auto-dismiss after 4 seconds: fade out (300ms)
  Manual dismiss: tap anywhere

Show for these metrics on their first appearance:
  Dashboard: TSB (form card)
  Progress: CTL, FTP
  Ride detail: TSS, NP, VI

Never show more than one at a time.
Never show if user is knowledge_level = 'advanced'.
```

---

## 5. TSS WEEKLY SUMMARY CONTEXT

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update the weekly TSS chart on ProgressScreen.tsx to include context.

CURRENT (bad):
  Bar chart with TSS values. User sees numbers. Nothing else.

NEW (good):

Above chart:
  This week's TSS + range label:
  "312 TSS  ·  Big week"
  BarlowCondensed-Bold 22px + MetricBadge

Below chart:
  Two contextual lines:
  
  Line 1 — vs personal average:
    "↑ 18% above your 8-week average"  (green if up, neutral if normal, amber if way up)
  
  Line 2 — guidance:
    Dynamically generated from METRIC_CONTEXT.tss.weeklyRanges:
    TSS 0–150:    "Good recovery week load."
    TSS 150–300:  "Solid week. Body is adapting."
    TSS 300–450:  "Big week. Plan a lighter one next."
    TSS 450–600:  "Very heavy load. Watch fatigue closely."
    TSS 600+:     "Extreme week. Recovery is critical."

On bar tap (existing tooltip):
  CURRENT: "Week of May 20 · 312 TSS"
  NEW: "Week of May 20 · 312 TSS · Big week"
  Add range label to every bar tooltip.

Chart Y-axis (visible for intermediate/advanced users):
  Add reference lines:
  - Dashed line at user's 8-week average (label: "Your avg")
  - No other lines — keep it clean
```

---

## 6. FORM SCALE — VISUAL LEGEND

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Update the TrainingScaleBar component and Dashboard hero card
to include a clear visual legend for the TSB scale.

CURRENT: Scale bar with dot. No labels. User doesn't know what position means.

NEW — Scale bar with zone labels:

  Overtrained   Tired    Optimal    Fresh
  ─────────────────────────────────────────
  ░░░░░░░░░░▓▓▓▓▓▓████████████░░░░░░░░░░
                        ●
  -30        -10       +2         +20

Labels:
  "Overtrained" — rose-400, 9px, above left
  "Tired"       — amber-400, 9px
  "Optimal"     — textDim, 9px (current zone highlighted)
  "Fresh"       — green, 9px, above right

Current zone label (dynamic, below bar):
  "You're in the Optimal zone."
  DMSans 12px, textSecondary
  
  OR for edge cases:
  "You're overtrained — rest is the only fix."
  "Very fresh — consider adding a workout."

Dot indicator:
  White circle, 10px, shadow
  Animates to position on mount (spring, 600ms)
  Current zone color ring around dot (3px ring)

This replaces the existing abstract scale bar everywhere it's used.
```

---

## 7. RIDE EFFORT RATING — REPLACE RAW TSS

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

On RideDetailScreen, replace the raw TSS display for beginner users
with a human-readable effort rating system.

Create mobile/src/components/ride/EffortRating.tsx

Props: tss, duration_min, knowledge_level

BEGINNER VIEW:
  Star rating (1–5) + label + one-line context
  
  ★☆☆☆☆  "Light ride"      TSS 0–50
  ★★☆☆☆  "Moderate effort" TSS 50–100
  ★★★☆☆  "Solid workout"   TSS 100–150
  ★★★★☆  "Hard day"        TSS 150–200
  ★★★★★  "Maximum effort"  TSS 200+
  
  Stars: filled stars in green, empty in surfaceAlt
  Star size: 18px
  Label: BarlowCondensed-Bold 16px
  Context: DMSans 13px, textSecondary
  
  Example:
  ★★★☆☆  Solid workout
  "This was a good training stimulus. 
   Plan something easy tomorrow."

INTERMEDIATE VIEW (expandable):
  Same stars + label
  Below expand: "TSS: 112 · What's TSS? ⓘ"
  
ADVANCED VIEW:
  TSS number primary, stars secondary

Context sentences per level (from METRIC_CONTEXT + duration):
  Light:    "Easy effort. Good for active recovery or building habit."
  Moderate: "Solid ride. Body will adapt from this."
  Hard:     "Demanding session. Eat well and sleep tonight."
  Very hard:"Big effort. At least one easy day before going hard again."
  Max:      "You emptied the tank. Two recovery days minimum."

Replace existing TSS StatCard with EffortRating on beginner/intermediate RideDetailScreen.
Advanced users: show both (EffortRating + raw TSS card).
```

---

## 8. APP STORE READINESS — FINAL CHECKLIST

```
Read CLAUDE.md and docs/agents/AGENT-DEV.md.

Create scripts/appStoreChecklist.js that scans the project
and verifies App Store submission requirements.

Check and report on:

REQUIRED (blocks submission):
  [ ] app.json has name, version, bundleIdentifier (iOS), package (Android)
  [ ] app.json has privacy policy URL (privacyPolicyUrl field)
  [ ] app.json has description (min 80 chars for App Store)
  [ ] HealthKit entitlement + NSHealthShareUsageDescription in Info.plist
  [ ] No console.log() calls with sensitive data (scan backend/src)
  [ ] .env is in .gitignore
  [ ] No hardcoded API keys in any source file

IMPORTANT (should fix before submission):
  [ ] App icon exists at correct sizes (1024x1024 for App Store)
  [ ] Splash screen configured in app.json
  [ ] eas.json exists with production profile
  [ ] All feature flags set correctly for production
  [ ] MOCK_EXTERNAL_APIS=false in production env
  [ ] Error boundaries on all main screens

RECOMMENDED:
  [ ] Terms of service URL in app.json
  [ ] Support email configured
  [ ] App Store screenshots exist (docs/screenshots/)
  [ ] Keywords list prepared (docs/app-store-keywords.txt)

Run with: node scripts/appStoreChecklist.js
Output: checklist with ✅ / ❌ / ⚠️ per item + fix instructions
```
