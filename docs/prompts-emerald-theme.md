# Claude Code Prompts — Posodobljeni Design Tokens (Emerald + Auto Dark Mode)

Primarna barva: Smaragdno zelena (#059669)
Tema: Auto (sistem) + ročni toggle
Zamenjuje: prejšnje antracit/slate promte

---

## 1. POSODOBLJENI DESIGN TOKENS

```
Read CLAUDE.md. Update mobile/src/theme/tokens.ts with the new color system.
Replace all previous primary/accent colors completely.

LIGHT MODE TOKENS:

Primary — Emerald Green:
  primary-50:   '#ECFDF5'
  primary-100:  '#D1FAE5'
  primary-200:  '#A7F3D0'
  primary-300:  '#6EE7B7'
  primary-400:  '#34D399'
  primary-500:  '#10B981'
  primary-600:  '#059669'   ← main brand color
  primary-700:  '#047857'
  primary-800:  '#065F46'
  primary-900:  '#064E3B'

Surfaces:
  background:        '#F7FAF8'   ← slightly green-tinted white
  surface:           '#FFFFFF'
  surface-raised:    '#F0FAF5'
  surface-hero:      '#059669'   ← primary color for hero cards
  border:            '#D1FAE5'   ← green-tinted border
  border-subtle:     '#ECFDF5'

Text:
  text-primary:   '#0F172A'
  text-secondary: '#475569'
  text-tertiary:  '#94A3B8'
  text-on-primary: '#FFFFFF'

Status colors (unchanged):
  success: '#10B981'
  warning: '#F59E0B'
  danger:  '#EF4444'
  info:    '#3B82F6'

DARK MODE TOKENS:

  background:        '#000000'   ← pure black (like iOS dark mode)
  surface:           '#0F0F0F'   ← near black
  surface-raised:    '#1A1A1A'   ← elevated cards
  surface-hero:      '#111111'   ← hero card bg (dark, NOT green)
  border:            '#2A2A2A'   ← subtle border
  border-subtle:     '#1F1F1F'

Primary in dark mode:
  primary-main:  '#34D399'   ← lighter emerald — pops on black
  primary-light: '#6EE7B7'
  primary-dim:   '#10B981'

Text dark:
  text-primary:   '#FFFFFF'    ← pure white
  text-secondary: '#A3A3A3'    ← neutral grey
  text-tertiary:  '#525252'    ← dim grey
  text-on-primary: '#000000'

Power zone colors (same in both modes — always readable):
  Z1: '#CBD5E1'   Z2: '#60A5FA'   Z3: '#34D399'
  Z4: '#FBBF24'   Z5: '#F97316'   Z6: '#F43F5E'   Z7: '#A855F7'

Export both LIGHT_TOKENS and DARK_TOKENS objects.
Export a getTokens(colorScheme: 'light' | 'dark') function.
```

---

## 2. THEME PROVIDER Z AUTO + MANUAL MODE

```
Read CLAUDE.md. Create mobile/src/theme/ThemeProvider.tsx — 
the context that manages light/dark/auto mode across the whole app.

Theme modes:
  'auto':   follows system (useColorScheme from react-native)
  'light':  always light
  'dark':   always dark

Implementation:

import { useColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = '@theme_mode'

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme()  // 'light' | 'dark'
  const [mode, setMode] = useState<'auto' | 'light' | 'dark'>('auto')

  // Load saved preference on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(saved => {
      if (saved) setMode(saved as ThemeMode)
    })
  }, [])

  // Resolved scheme: what actually shows
  const resolvedScheme = mode === 'auto' ? systemScheme : mode

  // Save when changed
  const changeMode = (newMode: ThemeMode) => {
    setMode(newMode)
    AsyncStorage.setItem(STORAGE_KEY, newMode)
  }

  const tokens = getTokens(resolvedScheme ?? 'light')

  return (
    <ThemeContext.Provider value={{ mode, resolvedScheme, tokens, changeMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

Export hook: useTheme() → { mode, resolvedScheme, tokens, changeMode }

Wrap the entire app in ThemeProvider in App.tsx.
Update React Navigation theme to use resolvedScheme.
```

---

## 3. THEME TOGGLE KOMPONENTA

```
Read CLAUDE.md. Create mobile/src/components/ui/ThemeToggle.tsx —
a clean toggle component for the Profile/Settings screen.

Design: 3-option segmented control (not a simple on/off toggle)

┌─────────────────────────────────────┐
│  ☀️ Svetla   │  🌙 Temna   │  Auto  │
│              │    ●         │        │
└─────────────────────────────────────┘

Props:
  currentMode: 'light' | 'dark' | 'auto'
  onChange: (mode: ThemeMode) => void

Style:
  - Container: surface-raised bg, border-radius 12, padding 3
  - Active option: white bg (light mode) or surface bg (dark mode), border-radius 9, shadow-sm
  - Inactive: transparent bg
  - Label: 12px, font-weight 500
  - Active label: primary-600 (light) or primary-400 (dark)
  - Transition: smooth spring animation (react-native-reanimated)

Also create a QuickToggle component for the header:
  - Small icon button in top-right of every screen
  - Light mode: 🌙 moon icon (slate-400)
  - Dark mode: ☀️ sun icon (primary-400)
  - Tap: cycles auto → light → dark → auto
  - Long press: opens full ThemeToggle in a small popover
  - Accessibility: proper accessibilityLabel

Add QuickToggle to the main navigation header (React Navigation headerRight).
```

---

## 4. POSODOBLJENE KOMPONENTE ZA NOVO BARVO

```
Read CLAUDE.md. Update all UI components in mobile/src/components/ui/
to use the new emerald theme via useTheme() hook.

Key changes from previous slate/indigo theme:

Button.tsx:
  primary variant: background = tokens.primary-600 (light) or tokens.primary-500 (dark)
  Text: white in both modes

Card.tsx:
  hero variant (new, replaces 'dark'):
    light: background = tokens.surface-hero (#059669), text white
    dark:  background = tokens.surface-hero (#063B22), text tokens.primary-300
  
  tinted variant:
    light: background = tokens.primary-50, border = tokens.border
    dark:  background = tokens.surface-raised, border = tokens.border

Badge.tsx:
  'primary' color:
    light: bg = primary-50, text = primary-700
    dark:  bg = rgba(52,211,153,0.15), text = primary-400

StatCard.tsx:
  Trend positive: primary-600 (light) / primary-400 (dark)
  Trend negative: danger red (unchanged)

SectionHeader.tsx:
  action link color: primary-600 (light) / primary-400 (dark)

Tab bar active color:
  light: primary-600
  dark:  primary-400

All components must call useTheme() to get current tokens —
never hardcode colors.
```

---

## 5. DARK MODE — SPECIFIČNI ZASLONI

```
Read CLAUDE.md. Update screen-specific dark mode styles.

DashboardScreen.tsx hero card:
  Light: solid primary-600 green background, white text
  Dark:  #111111 background, primary-400 (#34D399) text accent
         Border: 1px solid #2A2A2A — clean, no green tint

ProgressScreen.tsx FTP card:
  Light: surface white, primary-600 accent border-left 3px
  Dark:  #0F0F0F surface, primary-400 accent border-left 3px

RecoveryScreen.tsx score dial:
  Score arc color same in both modes (emerald/amber/rose by score)
  Background:
    Light: surface white
    Dark:  #1A1A1A — pure dark, no green

WorkoutCard:
  Today highlight:
    Light: primary-50 bg, primary-200 border, primary-600 left border 3px
    Dark:  #1A1A1A bg, #2A2A2A border, primary-400 left border 3px

Charts (TSS bars, zone distribution):
  Active/current bar:
    Light: primary-600
    Dark:  primary-400
  Inactive bars:
    Light: slate-200
    Dark:  #2A2A2A — neutral dark grey, no green tint

All skeleton loaders:
  Light: shimmer from slate-100 to slate-200
  Dark:  shimmer from #1A1A1A to #2A2A2A
```

---

## 6. SETTINGS SCREEN — TEMA NASTAVITVE

```
Read CLAUDE.md. Update mobile/src/screens/ProfileScreen.tsx settings section.

Add "Izgled" section with:

Row: "Tema aplikacije"
  Left: paint bucket icon (primary color)
  Right: current mode label ("Samodejno", "Svetla", "Temna")
  Tap → opens bottom sheet with ThemeToggle component

Bottom sheet:
  Title: "Tema"
  ThemeToggle (3-option segmented)
  
  Below toggle: live preview of current theme
  Small phone mockup (100px wide) showing Dashboard in selected theme
  Updates in real-time as user taps options
  
  Note below: "Samodejno sledi nastavitvam tvojega telefona"
  
  Dismiss on swipe or tap outside — no save button needed
  (saves automatically via AsyncStorage on each tap)

Also: respect system appearance changes while app is open
  useEffect watching useColorScheme() — if mode is 'auto' and system changes,
  re-render immediately without app restart.
```

---

## 7. POSODOBLJENI MASTER PROMPT

```
Read CLAUDE.md and docs/prompts-ui-design-sistem.md.

IMPORTANT: The design system has been updated. Use these new values everywhere:

Primary color: Emerald Green #059669 (light) / #34D399 (dark)
Background: #F7FAF8 (light) / #0A1410 (dark)
Surface hero: #059669 (light) / #063B22 (dark)

Theme system: ThemeProvider with 3 modes (auto/light/dark)
All components: use useTheme() hook, never hardcode colors
Toggle: QuickToggle in header + full toggle in Profile settings

Previous slate-primary and indigo-accent are REPLACED.
Indigo is still used for informational badges/chips only.

Ignore any hardcoded colors from previous prompts.
The single source of truth is mobile/src/theme/tokens.ts.
```
