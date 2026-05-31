# Claude Code Prompts — UI Design Sistem (Antracit / Slate tema)

Primarna barva: Antracit / Slate — premium, nevtralna, profesionalna.
Svetla tema. Jasno različna od Strave (brez oranžne).

---

## 1. DESIGN TOKENS — CORE SISTEM

```
Read CLAUDE.md. Create mobile/src/theme/tokens.ts — the single source of truth for all design decisions in the app.

COLOR PALETTE:

Primary — Antracit Slate:
  slate-50:  '#F8F8F7'
  slate-100: '#EEEEED'
  slate-200: '#D4D4D2'
  slate-400: '#8C8C89'
  slate-600: '#4A4A47'
  slate-800: '#1F1F1E'
  slate-900: '#0D0D0C'

Accent — Electric Indigo (calls to action, active states):
  indigo-50:  '#EEEEFF'
  indigo-100: '#C7C7FF'
  indigo-400: '#6366F1'
  indigo-600: '#4338CA'
  indigo-800: '#1E1B5E'

Success — Emerald:
  emerald-50:  '#ECFDF5'
  emerald-400: '#34D399'
  emerald-600: '#059669'

Warning — Amber:
  amber-50:  '#FFFBEB'
  amber-400: '#FBBF24'
  amber-600: '#D97706'

Danger — Rose:
  rose-50:  '#FFF1F2'
  rose-400: '#FB7185'
  rose-600: '#E11D48'

Info — Sky:
  sky-50:  '#F0F9FF'
  sky-400: '#38BDF8'
  sky-600: '#0284C7'

Neutral surfaces:
  background:        '#FAFAF9'
  surface:           '#FFFFFF'
  surface-raised:    '#F4F4F3'
  border:            '#E8E8E6'
  border-subtle:     '#F0F0EE'

Text:
  text-primary:   '#0D0D0C'
  text-secondary: '#525250'
  text-tertiary:  '#9C9C99'
  text-inverse:   '#FAFAF9'

TYPOGRAPHY:
  fontFamily: {
    sans: 'GeneralSans-Variable',    // primary UI font
    mono: 'JetBrainsMono-Regular',   // numbers, stats, power values
  }
  fontSize: {
    xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, '2xl': 30, '3xl': 38
  }
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' }
  lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.7 }

SPACING (8pt grid):
  1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64

BORDER RADIUS:
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, full: 9999

SHADOWS (subtle, no heavy drop shadows):
  sm: { shadowColor: '#0D0D0C', shadowOffset: {width:0, height:1}, shadowOpacity: 0.04, shadowRadius: 2, elevation: 1 }
  md: { shadowColor: '#0D0D0C', shadowOffset: {width:0, height:2}, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 }

Export all tokens as a flat object and also as a theme object compatible with React Navigation.
```

---

## 2. TYPOGRAPHY — FONT SETUP

```
Read CLAUDE.md. Set up custom fonts in the React Native Expo app.

1. Install fonts via expo-font:
   - General Sans Variable (from fontsource or local assets) — primary UI font, clean geometric
   - JetBrains Mono — for power numbers, stats, data values (gives a sport/tech feel)
   - If General Sans is not available, use 'Outfit' from Google Fonts as fallback

2. Create mobile/src/theme/typography.ts with text style presets:
   - heading1: { fontSize: 30, fontWeight: '700', fontFamily: 'GeneralSans', letterSpacing: -0.8 }
   - heading2: { fontSize: 24, fontWeight: '600', fontFamily: 'GeneralSans', letterSpacing: -0.5 }
   - heading3: { fontSize: 20, fontWeight: '600', fontFamily: 'GeneralSans', letterSpacing: -0.3 }
   - bodyLarge: { fontSize: 17, fontWeight: '400', fontFamily: 'GeneralSans', lineHeight: 26 }
   - body: { fontSize: 15, fontWeight: '400', fontFamily: 'GeneralSans', lineHeight: 23 }
   - caption: { fontSize: 13, fontWeight: '400', color: text-secondary }
   - label: { fontSize: 11, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' }
   - stat: { fontSize: 38, fontWeight: '700', fontFamily: 'JetBrainsMono', letterSpacing: -1 }
   - statMd: { fontSize: 24, fontWeight: '600', fontFamily: 'JetBrainsMono', letterSpacing: -0.5 }
   - statSm: { fontSize: 17, fontWeight: '500', fontFamily: 'JetBrainsMono' }

3. Create a <Text> wrapper component mobile/src/components/ui/Text.tsx that accepts a variant prop
   (heading1 | heading2 | body | caption | label | stat | statMd | statSm) and applies the correct style.
   Always use this instead of React Native's raw <Text>.
```

---

## 3. KOMPONENTE — CORE UI KIT

```
Read CLAUDE.md. Build the core component library in mobile/src/components/ui/.

Create these components:

1. Card.tsx
   - Props: variant ('default' | 'raised' | 'dark' | 'tinted'), padding, onPress
   - default: white bg, 1px border (#E8E8E6), border-radius 16
   - raised: white bg, shadow-md, border-radius 16
   - dark: slate-900 bg, used for hero cards (form status, FTP)
   - tinted: slate-50 bg, border-radius 12, no border

2. Badge.tsx
   - Props: label, color ('default' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky')
   - Small pill: font-size 11, font-weight 600, uppercase, letter-spacing 0.5
   - Each color has light bg + dark text from same ramp

3. Button.tsx
   - Props: label, variant ('primary' | 'secondary' | 'ghost' | 'danger'), size ('sm' | 'md' | 'lg'), loading, icon, onPress
   - primary: slate-900 bg, white text — NOT indigo (keep CTA premium and brand-consistent)
   - secondary: white bg, slate-900 border, slate-900 text
   - ghost: transparent bg, slate-600 text
   - loading: shows ActivityIndicator replacing label
   - Haptic feedback on press (expo-haptics, impactAsync Light)

4. StatCard.tsx
   - Props: value, unit, label, trend ('+12%' | '-3%' | null), size ('sm' | 'md' | 'lg')
   - value in JetBrains Mono font
   - trend arrow with emerald (positive) or rose (negative) color
   - Used everywhere for FTP, CTL, ATL, TSB, distance etc.

5. SectionHeader.tsx
   - Props: title, action (label + onPress)
   - title: uppercase, 11px, letter-spacing 0.6, slate-400
   - action: 13px, indigo-600, "Vse →"

6. Divider.tsx
   - 1px line, slate-100 color, optional label in center

7. SkeletonLoader.tsx
   - Animated shimmer placeholder for loading states
   - Props: width, height, borderRadius
   - Use react-native-reanimated for smooth shimmer animation

All components must support dark mode via useColorScheme() hook.
Export all from mobile/src/components/ui/index.ts.
```

---

## 4. POWER ZONE BARVE

```
Read CLAUDE.md. Create mobile/src/theme/zones.ts with cycling power zone definitions and colors.

Power zones (Coggan 7-zone model):
  Z1 — Active Recovery:   { color: '#CBD5E1', bg: '#F8FAFC', label: 'Aktivni počitek',  range: '< 55% FTP' }
  Z2 — Endurance:         { color: '#60A5FA', bg: '#EFF6FF', label: 'Vzdržljivost',      range: '56–75% FTP' }
  Z3 — Tempo:             { color: '#34D399', bg: '#ECFDF5', label: 'Tempo',             range: '76–90% FTP' }
  Z4 — Threshold:         { color: '#FBBF24', bg: '#FFFBEB', label: 'Prag',              range: '91–105% FTP' }
  Z5 — VO2max:            { color: '#F97316', bg: '#FFF7ED', label: 'VO2max',            range: '106–120% FTP' }
  Z6 — Anaerobic:         { color: '#F43F5E', bg: '#FFF1F2', label: 'Anaerobno',         range: '121–150% FTP' }
  Z7 — Neuromuscular:     { color: '#A855F7', bg: '#FAF5FF', label: 'Nevromišično',      range: '> 150% FTP' }

Also add:
  getZoneForPower(power: number, ftp: number): returns zone object for given power
  getZoneDistribution(powerStream: number[], ftp: number): returns % time in each zone

Use these colors EVERYWHERE zones appear: workout cards, ride analysis, charts.
This ensures visual consistency across the whole app.
```

---

## 5. DASHBOARD SCREEN — REDESIGN

```
Read CLAUDE.md. Redesign mobile/src/screens/DashboardScreen.tsx using the new design tokens and components.

LAYOUT:

Header (no border, clean):
  - Left: "Dober dan," in caption style + user's first name in heading2
  - Right: avatar circle (initials, slate-800 bg, white text) + notification bell icon

Hero Card (variant='dark', full width, padding 20):
  - Top row: "FORMA DANES" label (uppercase, slate-400, 11px) + form status badge
  - Form status values and badge colors:
    Svež (+15 to +25 TSB):      badge emerald,  text "Svež"
    Optimalen (+5 to +15 TSB):  badge indigo,   text "Optimalen"
    Utrujen (-10 to +5 TSB):    badge amber,    text "Utrujen"
    Preobremenjen (< -10 TSB):  badge rose,     text "Preobremenjen"
  - TSB number: stat size (JetBrains Mono, 38px, white)
  - Subtitle: "Pripravljen na trening" in caption, slate-400
  - Bottom row: 3 mini stats (CTL / ATL / TSB) in equal columns
    Each: value in statSm, label in label style, slate-400

Sekcija "Ta teden":
  - SectionHeader with "Vsi treningi →"
  - Vertical list of workout cards
  - Each workout card (variant='tinted'):
    Left: colored vertical bar (3px wide, zone color), then workout name + duration/type
    Right: zone badge
  - Today's workout: Card variant='raised' with slate-900 left border (4px)

Sekcija "Zadnja vožnja":
  - Horizontal scroll of 3 StatCards: distance, NP power, duration
  - Below: "Poglej analizo →" link in indigo-600

Bottom: "Sinhroniziraj Strava" subtle banner if last sync > 24h ago.
```

---

## 6. PROGRESS SCREEN — REDESIGN

```
Read CLAUDE.md. Redesign mobile/src/screens/ProgressScreen.tsx.

LAYOUT:

Header: "Napredek" in heading2 + Strava sync status pill (emerald dot + "Sinhronizirano" or amber dot + "Sync potreben")

FTP Hero Card (variant='dark'):
  - Left: FTP value in stat style (JetBrains Mono, 38px, white) + "watts" unit
  - Right: W/kg in statMd (JetBrains Mono) + rider category badge below
  - Rider categories with badge colors:
    < 2.0 W/kg:  "Rekreativec"     slate
    2.0–3.0:     "Fitnes kolesar"  sky
    3.0–4.0:     "Amater"          indigo
    4.0–5.0:     "Napredni amater" emerald
    > 5.0:       "Elite"           amber
  - Bottom: FTP improvement chip "+12W od zadnjega testa ↑" in emerald

Fitness triad (3 StatCards in a row):
  CTL: value + "Fitnes" label + 4-week sparkline
  ATL: value + "Utrujenost" label
  TSB: value + "Forma" label + color by value (emerald if positive, rose if negative)

TSS Chart:
  Card with "TEDENSKI TSS" section header
  Bar chart — last 8 weeks
  Bars: slate-200 for past weeks, slate-800 for current week
  X axis: week labels in caption style
  Tap bar → show week details tooltip

Personal Records:
  Horizontal scroll
  Gold PR card (amber-50 bg, amber-600 border-left 3px): best 5min power
  Regular PR cards for 20min power, longest ride, most elevation
  Each card: value in statMd, label in caption

AI Coach card (variant='raised'):
  Slate robot icon + "AI trener" label + cached timestamp
  2-3 sentence weekly insight text
  "Osveži analizo" ghost button (right-aligned, small)
```

---

## 7. NAVIGATION — TAB BAR

```
Read CLAUDE.md. Redesign the bottom tab bar in mobile/src/navigation/index.tsx.

Tab bar style:
  - Background: white, top border 1px slate-100
  - 4 tabs: Domov, Napredek, Vožnje, Profil
  - Icons: use @expo/vector-icons Feather set
    Domov: home, Napredek: activity, Vožnje: map, Profil: user
  - Inactive: slate-400 icon + slate-400 label (11px)
  - Active: slate-900 icon + slate-900 label (11px, weight 600) + 2px slate-900 top border on tab
  - NO colored active indicator — just weight and border change (clean, editorial feel)
  - Add Strava sync dot: small 6px emerald dot on "Vožnje" tab icon when new activities available

Header style (React Navigation):
  - Background: white
  - Title: heading3 style, slate-900, centered
  - Back button: slate-600, no default arrow — use Feather 'chevron-left' icon
  - Border bottom: 1px slate-100

Remove any shadows from both header and tab bar — clean flat look.
```

---

## 8. MICRO-INTERAKCIJE IN ANIMACIJE

```
Read CLAUDE.md. Add micro-interactions throughout the app using react-native-reanimated.

1. Number reveal animation (for FTP, CTL, ATL, TSB values):
   - On screen mount: numbers count up from 0 to final value over 800ms
   - Easing: easeOutCubic
   - Apply to all StatCard components
   - Use Reanimated's useSharedValue + withTiming

2. Form status card entrance:
   - Slide up + fade in from 20px below on Dashboard mount
   - Delay: 100ms after screen appears
   - Duration: 400ms, easeOutQuart

3. Workout card press:
   - Scale down to 0.97 on press in (spring, 150ms)
   - Scale back to 1.0 on release
   - Use Pressable with Animated.spring

4. Sync button:
   - While syncing: rotate icon 360° continuously (useSharedValue loop)
   - On complete: checkmark icon swap with scale bounce animation

5. Zone bar chart:
   - Bars animate from 0% to final width on screen mount
   - Staggered: each bar starts 50ms after previous
   - Duration: 600ms per bar, easeOutExpo

6. Tab bar active state:
   - Top border slides in from left (width 0 → 100%) on tab activation
   - Duration: 200ms

Keep all animations subtle and purposeful — no over-animation.
Every animation should make the app feel faster and more responsive, not flashy.
```

---

## 9. DARK MODE SUPPORT

```
Read CLAUDE.md. Add complete dark mode support to the app.

Create mobile/src/theme/darkTokens.ts with dark mode overrides:

  background:     '#0D0D0C'
  surface:        '#1A1A19'
  surface-raised: '#242423'
  border:         '#2E2E2C'
  border-subtle:  '#222221'
  text-primary:   '#F4F4F2'
  text-secondary: '#9C9C99'
  text-tertiary:  '#5C5C5A'

  Dark hero card (variant='dark') becomes:
    surface: '#1A1A19', border: '#2E2E2C' (subtle elevation without pure black)

Create mobile/src/theme/useTheme.ts hook:
  - Uses useColorScheme() from react-native
  - Returns the correct token set based on system theme
  - Wrap with React Context so all components access theme without prop drilling

Update ALL components from step 3 to use useTheme() instead of hardcoded colors.
Test: every screen must be fully readable in both light and dark mode.

Add a theme toggle in Profile screen settings (auto / light / dark).
Store preference in AsyncStorage.
```
