# Claude Code Prompts — Razumljive metrike in statistika

Cilj: vsak kolesarski podatek mora biti razumljiv brez predznanja.
Številke so sekundarne. Plain language je primaren.

---

## 1. METRICS INTERPRETER SERVICE

```
Read CLAUDE.md. Create mobile/src/services/metricsInterpreter.ts — a service that
converts raw training numbers into plain Slovenian language explanations.

Implement these functions:

1. interpretTSB(tsb: number): TrainingStatus
   Returns:
   {
     status: 'overreached' | 'tired' | 'optimal' | 'fresh' | 'very_fresh',
     label: string,           // "Optimalna forma"
     description: string,     // "Idealen čas za kakovosten trening"
     todayAdvice: string,     // "Danes zmoreš intenziven trening ali dolgo vožnjo"
     color: string,           // token color key
     emoji: string,
     scalePosition: number    // 0–100 for visual scale position
   }

   Rules:
   tsb < -25:        overreached  — "Preobremenitev ⚠️" — "Potrebuješ vsaj 2 dni počitka. Telo ne more napredovati v tem stanju."
   tsb -25 to -10:   tired        — "Utrujenost 🟡" — "Lahki treningi ali počitek danes"
   tsb -10 to +5:    optimal      — "Optimalna forma 🔵" — "Idealen čas za kakovosten trening"
   tsb +5 to +20:    fresh        — "Svež in pripravljen 🟢" — "Danes zmoreš vse — intervale, dolgo vožnjo, tekmo"
   tsb > +20:        very_fresh   — "Zelo svež — premalo treninga?" — "Forma je dobra ampak razmisli ali treniraš dovolj"

2. interpretCTL(ctl: number, ctlTrend: number): FitnessStatus
   ctlTrend = difference from 4 weeks ago
   Returns:
   {
     label: string,        // "Dobra osnovna forma"
     trend: string,        // "Raste +8 ta mesec 📈"
     category: string,     // "Rekreativec" | "Fitnes kolesar" | "Amater" | "Napredni amater" | "Elite"
     categoryRange: string // "Tipično za to raven: 40–60"
   }

   CTL categories:
   0–30:   "Začetnik" — "Gradiš osnovo. Fokus na rednosti."
   30–50:  "Rekreativec" — "Dobra osnovna vzdržljivost."
   50–70:  "Fitnes kolesar" — "Solidna forma za vikend kolesarje."
   70–90:  "Amater" — "Resno treniraš. Viden napredek."
   90–110: "Napredni amater" — "Visoka forma. Blizu profesionalnih ravni."
   > 110:  "Elite" — "Profesionalna raven obremenitve."

3. interpretATL(atl: number, atlTrend: number): FatigueStatus
   Returns:
   {
     label: string,     // "Zmerna utrujenost"
     advice: string,    // "Normalna utrujenost po aktivnem tednu"
     isHigh: boolean    // true if ATL > CTL + 15 (overreaching risk)
   }

4. interpretWeeklyTSS(tss: number, avgTss4weeks: number): VolumeStatus
   Returns:
   {
     label: string,          // "Dober teden"
     vsAverage: string,      // "+15% nad tvojim povprečjem"
     suggestion: string      // "Naslednji teden zmanjšaj za 10–15% (regeneracijski teden)"
   }

   Rules:
   tss < avgTss * 0.7:  "Lahek teden — premalo stimulusa"
   tss 0.7–0.9 * avg:  "Regeneracijski teden — dobro"
   tss 0.9–1.1 * avg:  "Normalen teden — v planu"
   tss 1.1–1.3 * avg:  "Težek teden — pazi na regeneracijo"
   tss > 1.3 * avg:    "Zelo težek teden — potreben je počitek"

5. interpretFTP(ftp: number, weight: number, prevFtp: number | null): FTPStatus
   Returns:
   {
     wattsPerKg: number,
     category: string,
     categoryDescription: string,
     changeLabel: string | null,  // "+12W od zadnjega testa (+4.4%)" or null
     nextMilestone: string        // "Do naslednje kategorije: +18W (4.0 W/kg)"
   }

Export all functions from this file.
```

---

## 2. KONTEKSTUALNA LESTVICA KOMPONENTA

```
Read CLAUDE.md. Create mobile/src/components/metrics/TrainingScaleBar.tsx

This component shows where the user sits on a spectrum — replaces raw numbers with visual context.

Props:
  value: number
  min: number        // e.g. -40 (extreme overreaching)
  max: number        // e.g. +30 (very fresh)
  zones: Array<{
    from: number,
    to: number,
    label: string,
    color: string
  }>
  showValue?: boolean

Visual design:
  - Horizontal bar, full width, height 6px
  - Bar is divided into colored zones (use gradient fills)
  - A circular indicator (12px white circle with shadow) slides to current value position
  - Below the bar: zone labels at key breakpoints (left: "Preobremenjen", center: "Optimalno", right: "Svež")
  - Current zone label highlighted in bold below center

For TSB scale, zones are:
  { from: -40, to: -20, label: 'Preobremenjen', color: rose-400 }
  { from: -20, to: -5,  label: 'Utrujen',        color: amber-400 }
  { from: -5,  to: +12, label: 'Optimalno',       color: indigo-400 }
  { from: +12, to: +25, label: 'Svež',            color: emerald-400 }
  { from: +25, to: +40, label: 'Zelo svež',       color: emerald-600 }

Animate the indicator sliding to position on mount (react-native-reanimated, 600ms spring).
```

---

## 3. TOOLTIP / "KAJ JE TO?" KOMPONENTA

```
Read CLAUDE.md. Create mobile/src/components/metrics/MetricTooltip.tsx

A small info button that opens an explanation popup for any metric.

Props:
  metric: 'tsb' | 'ctl' | 'atl' | 'ftp' | 'tss' | 'np' | 'vi' | 'ef' | 'wprime'
  triggerSize?: 'sm' | 'md'

Trigger: small ⓘ icon (Feather 'info', 12px, slate-400) next to metric label

On press: opens a bottom sheet modal (use @gorhom/bottom-sheet) with:
  - Metric name (heading3)
  - Simple one-line definition
  - "V tvojem primeru:" personalized explanation with current value
  - Visual example or analogy
  - Dismiss on swipe down or tap outside

Metric definitions:
  tsb:    { name: "Forma (TSB)", short: "Razlika med fitnesom in utrujenostjo.", analogy: "Kot baterija: pozitivno = napolnjena, negativno = prazna." }
  ctl:    { name: "Fitnes (CTL)", short: "42-dnevno povprečje tvojega treninga.", analogy: "Koliko 'forme v banki' imaš. Gradi se počasi, izgubi se počasi." }
  atl:    { name: "Utrujenost (ATL)", short: "7-dnevno povprečje — kako naporno je bil zadnji teden.", analogy: "Kako polne so noge danes." }
  ftp:    { name: "FTP — Funkcionalna mejna moč", short: "Maksimalna moč ki jo lahko vzdržuješ 1 uro.", analogy: "Tvoj 'motor'. Višji FTP = hitreje kolesariš z enako naporom." }
  tss:    { name: "Stres treninga (TSS)", short: "Skupna obremenitev vožnje — kombinacija časa in intenzivnosti.", analogy: "60 min @ FTP = 100 TSS. 2h lahke vožnje = ~60 TSS." }
  np:     { name: "Normalizirana moč (NP)", short: "Dejanska fiziološka obremenitev vožnje.", analogy: "Bolj realno kot povprečna moč — upošteva intervale in vzpone." }
  vi:     { name: "Indeks variabilnosti (VI)", short: "Kako enakomerna je bila tvoja moč.", analogy: "1.00 = popolnoma enakomerno. > 1.05 = zelo variabilno. Nižji = boljša kontrola tempa." }
  wprime: { name: "W' — Anaerobna kapaciteta", short: "Tvoja 'baterija za napore nad FTP'.", analogy: "Ko greš nad FTP trošiš W'. Ko si pod FTP se polni. Ko je prazna — konec sprinta." }

Also create a hook useMetricTooltip() that can be called from anywhere.
```

---

## 4. HERO FORMA KARTICA — REDESIGN

```
Read CLAUDE.md. Redesign the main form status hero card on DashboardScreen.tsx.
Replace abstract numbers with human-readable status.

NEW LAYOUT (dark card, slate-900 bg):

Row 1 — Primary status (most prominent element):
  Large status label from interpretTSB():
  e.g. "Optimalna forma" — font size 26px, white, General Sans, font-weight 600

Row 2 — Today's advice (immediately below):
  e.g. "Danes zmoreš intenziven trening ali dolgo vožnjo"
  font size 13px, slate-300, line-height 1.5

Row 3 — Visual scale bar:
  TrainingScaleBar component with TSB value
  Indicator pointing to current position
  Width: full card width minus padding

Row 4 — Secondary numbers (collapsed by default, expandable):
  3 columns: CTL | ATL | TSB
  Each: value in JetBrains Mono (small, 15px) + label + ⓘ tooltip trigger
  These are for advanced users — not the primary focus
  Small "Podrobnosti" chevron to expand/collapse this row

Row 5 — Trend chips (horizontal scroll):
  Small pill badges showing trends:
  "Fitnes ↑ +6 ta mesec"
  "Utrujenost ↓ dobro"
  "TSS ta teden: +12% nad povprečjem"

On tap of entire card → navigate to full Progress screen.
```

---

## 5. TEDENSKI POVZETEK KARTICA

```
Read CLAUDE.md. Create mobile/src/components/dashboard/WeekSummaryCard.tsx

A card on Dashboard that summarizes the current week in plain language.
Replaces raw weekly TSS numbers with context.

Props: weekMetrics (from performance_metrics table)

LAYOUT (Card variant='raised'):

Header row:
  "TA TEDEN" label (SectionHeader style) + week date range

Main message (from interpretWeeklyTSS()):
  e.g. "Dober teden 💪" — heading3
  e.g. "+15% nad tvojim povprečjem" — caption, slate-500

3 mini stats in a row:
  Left:   Distance with trend arrow vs last week
  Center: Elevation with trend arrow
  Right:  Ride count "3 vožnje"

Progress bar to weekly TSS goal:
  "Cilj: 400 TSS  ████████░░  312 TSS (78%)"
  Bar fill: indigo-400
  Label below: "Še 88 TSS do cilja" OR "Cilj dosežen ✓" in emerald

Bottom row (if applicable):
  Recovery week suggestion chip if needed:
  "💡 Naslednji teden: regeneracijski teden"
```

---

## 6. METRIKA KARTICA Z KONTEKSTOM

```
Read CLAUDE.md. Upgrade mobile/src/components/ui/StatCard.tsx (from prompt 3 of design system)
to support contextual display mode.

Add new props:
  interpretation?: string   // plain language from metricsInterpreter
  tooltipMetric?: string    // metric key for MetricTooltip
  scaleConfig?: object      // config for mini scale bar
  displayMode: 'number' | 'contextual' | 'both'  // default: 'both'

displayMode 'number':   shows only the raw value (for advanced users)
displayMode 'contextual': shows only the plain language interpretation
displayMode 'both':     shows interpretation as primary, number as secondary

Layout for 'both' mode:
  Top: interpretation string (body, slate-800)
  Below: raw number (JetBrains Mono, smaller, slate-400) + ⓘ tooltip
  Right: trend arrow

Example output:
  "Dober fitnes"        ← interpretation (primary)
  CTL 74  ⓘ  ↑+6      ← number + tooltip + trend (secondary)

Apply this upgrade everywhere StatCard is used:
  DashboardScreen hero card expansion
  ProgressScreen fitness triad
  FTP card
```

---

## 7. ONBOARDING — RAZLAGA METRIK

```
Read CLAUDE.md. Add a metrics education step to the onboarding flow.

After the first Strava sync completes and initial CTL/ATL/TSB are calculated,
show a one-time educational overlay: mobile/src/screens/MetricsIntroScreen.tsx

This is shown ONCE after first sync, never again (store seen flag in AsyncStorage).

LAYOUT — 3 swipeable cards (like a mini tutorial):

Card 1 — Forma:
  Large emoji: 🎯
  Title: "Tvoja forma danes"
  Body: "Vsak dan ti pokažemo ali si svež ali utrujen — in kaj to pomeni za trening."
  Visual: mini TrainingScaleBar with their actual TSB value highlighted
  "To je tvoja trenutna forma: Optimalna" — personalized with real data

Card 2 — Fitnes vs Utrujenost:
  Large emoji: 📈
  Title: "Fitnes raste počasi, utrujenost hitro"
  Body: "Fitnes (CTL) se gradi mesece. Utrujenost (ATL) pride in gre v dneh. Forma je razlika."
  Visual: simple animated line showing CTL going up slowly, ATL spiking and recovering

Card 3 — FTP:
  Large emoji: ⚡
  Title: "Tvoj motor — FTP"
  Body: "Višji FTP = enaka hitrost z manj napora. Vsak W/kg šteje na klancu."
  Visual: their actual FTP value + rider category badge
  "Ti si: Amater — 3.8 W/kg" — personalized

Bottom: "Razumem, začnimo!" CTA button → navigate to Dashboard
Skip link: "Preskočim" in small text

After this screen: Dashboard hero card makes complete sense to the user.
```

---

## 8. KONTEKSTUALNI NASVETI — AI NUDGE SISTEM

```
Read CLAUDE.md. Create mobile/src/services/nudgeService.ts — a rule-based system
that generates timely, contextual tips throughout the app.

These are NOT AI-generated (no tokens used) — purely rule-based.
They appear as subtle tip cards or banners at the right moment.

Implement checkNudges(userId, currentMetrics): Nudge[]

Rules:

RECOVERY NUDGES (high priority):
  if TSB < -20:
    "Telo prosi za počitek. Danes lahka vožnja ali dan brez kolesa."
  if ATL increased > 20% in 5 days:
    "Hitro si povečal obremenitev. Tveganje za poškodbo je višje."
  if 7+ consecutive days with rides and ATL > CTL:
    "7 dni zapored brez počitka. Vključi vsaj en prosti dan na teden."

PROGRESS NUDGES (medium priority):
  if no FTP test in > 42 days:
    "Že 6 tednov od zadnjega FTP testa. Morda si napredoval?"
  if CTL increased > 10 in one month:
    "Fitnes je narasel za 10 točk ta mesec. Odlično napredovanje! 🎉"
  if 3 weeks of TSS decline:
    "Zadnje 3 tedne treniraš manj. Vse ok?"

PERFORMANCE NUDGES (low priority):
  if new personal record set:
    "Nov osebni rekord! [duration] moč: [value]W 🏆"
  if watts_per_kg crosses a threshold (e.g. crosses 3.5, 4.0):
    "Prešel si mejo 4.0 W/kg! To je napredni amater nivo."

Each Nudge:
  { id, message, detail, priority, icon, action: { label, screen } | null, expiresAt }

Display nudges:
  - High priority: banner at top of Dashboard (dismissible, reappears after 24h)
  - Medium priority: card in Dashboard below workout list
  - Low priority: subtle chip in Progress screen header

Store dismissed nudges in AsyncStorage so they don't repeat.
Show max 2 nudges at once to avoid overwhelm.
```
