// Design tokens — the single source of truth for every visual decision in the
// app. Theme: Emerald Green (#059669) with auto/light/dark mode. Neutrals are
// standard slate; the brand is emerald; indigo is reserved for info badges.
//
// Consume these everywhere instead of hardcoding values. A dark-mode override
// set lives in ./darkTokens; ./useTheme picks the right set at runtime.

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
export const palette = {
  // Neutral ramp — slate (true neutral grays).
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate400: '#94A3B8',
  slate600: '#475569',
  slate800: '#1E293B',
  slate900: '#0F172A',

  // Brand — Emerald Green (CTA, active states, accents)
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald200: '#A7F3D0',
  emerald300: '#6EE7B7',
  emerald400: '#34D399', // primary (dark mode)
  emerald500: '#10B981',
  emerald600: '#059669', // primary (light mode) — main brand color
  emerald700: '#047857',
  emerald800: '#065F46',
  emerald900: '#064E3B',

  // Indigo — informational badges / chips only (NOT the brand anymore)
  indigo50: '#EEF2FF',
  indigo100: '#C7D2FE',
  indigo400: '#818CF8',
  indigo600: '#4F46E5',
  indigo800: '#3730A3',

  // Warning — Amber
  amber50: '#FFFBEB',
  amber400: '#FBBF24',
  amber600: '#F59E0B',

  // Danger — Red
  rose50: '#FEF2F2',
  rose400: '#FB7185',
  rose600: '#EF4444',

  // Info — Blue
  sky50: '#EFF6FF',
  sky400: '#60A5FA',
  sky600: '#3B82F6',
} as const;

// Power-zone colors — theme-independent (used by zone bars, charts, badges).
export const zoneColors = {
  z1: '#94A3B8', // recovery
  z2: '#60A5FA', // endurance
  z3: '#34D399', // tempo
  z4: '#FBBF24', // threshold
  z5: '#F97316', // VO2max
  z6: '#EF4444', // anaerobic
  z7: '#A855F7', // neuromuscular
} as const;

// Semantic colors (light theme). Dark overrides live in ./darkTokens.
// Athletic / Strava-inspired: warm off-white surfaces, near-black text, green
// used sparingly, and an achievement orange reserved for PRs/records only.
export const colors = {
  ...palette,

  // Neutral surfaces (warm, not clinical)
  background: '#F5F5F3',
  surface: '#FFFFFF',
  surfaceRaised: '#EFEFED', // surface alt — used instead of borders where possible
  surfaceHero: '#111110', // hero / form / FTP cards — dark, numbers pop
  border: '#E8E8E6',
  borderSubtle: '#F0EFEB',

  // Text (warm near-black)
  textPrimary: '#111110',
  textSecondary: '#6B6B69',
  textTertiary: '#ADADAA',
  textInverse: '#FFFFFF', // text on green / on dark surfaces

  // Role aliases
  primary: '#059669', // green — buttons / CTA (sparingly)
  primaryLight: '#34D399',
  primaryDark: '#065F46',
  primaryTint: '#ECFDF5',
  accent: '#059669', // links / active tab / text accents
  success: '#10B981',
  warning: '#D97706',
  danger: '#DC2626',
  info: '#3B82F6',

  // Athletic aliases (new design language)
  bg: '#F5F5F3',
  surfaceAlt: '#EFEFED',
  surfaceDark: '#111110',
  textDim: '#ADADAA',
  green: '#059669',
  greenLight: '#ECFDF5',
  greenDim: '#D1FAE5',
  achievement: '#E8420A', // PRs, records, milestones ONLY
  achievementBg: '#FFF0EB',
} as const;

export const LIGHT_TOKENS = colors;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// Athletic type stack (see ./typography for the full preset scale + the asset
// map registered with expo-font in App.tsx). DM Sans for body/labels, Barlow
// Condensed for big numbers, JetBrains Mono for live/precise data values.
export const fontFamily = {
  sans: 'DMSans_400Regular',
  display: 'BarlowCondensed_900Black',
  mono: 'JetBrainsMono_400Regular',
} as const;

export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  '2xl': 30,
  '3xl': 38,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export const lineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// ---------------------------------------------------------------------------
// Spacing (8pt grid)
// ---------------------------------------------------------------------------
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

// ---------------------------------------------------------------------------
// Border radius
// ---------------------------------------------------------------------------
export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows (subtle — no heavy drop shadows)
// ---------------------------------------------------------------------------
export const shadows = {
  sm: {
    shadowColor: '#0D0D0C',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#0D0D0C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
} as const;

// ---------------------------------------------------------------------------
// Flat token object — one import for everything.
// ---------------------------------------------------------------------------
export const tokens = {
  palette,
  colors,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  spacing,
  radius,
  shadows,
} as const;

// ---------------------------------------------------------------------------
// React Navigation theme objects (light). Shape matches @react-navigation/native
// `Theme`. The dark counterpart is built from darkTokens in ./useTheme.
// ---------------------------------------------------------------------------
export const navigationTheme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.accent,
  },
};

export type Tokens = typeof tokens;

export default tokens;
