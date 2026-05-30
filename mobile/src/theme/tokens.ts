// Design tokens — the single source of truth for every visual decision in the
// app. Theme: Antracit / Slate (premium, neutral, light). Deliberately distinct
// from Strava (no orange in the core palette).
//
// Consume these everywhere instead of hardcoding values. A dark-mode override
// set lives in ./darkTokens; ./useTheme picks the right set at runtime.

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
export const palette = {
  // Primary — Antracit Slate
  slate50: '#F8F8F7',
  slate100: '#EEEEED',
  slate200: '#D4D4D2',
  slate400: '#8C8C89',
  slate600: '#4A4A47',
  slate800: '#1F1F1E',
  slate900: '#0D0D0C',

  // Accent — Electric Indigo (calls to action, active states)
  indigo50: '#EEEEFF',
  indigo100: '#C7C7FF',
  indigo400: '#6366F1',
  indigo600: '#4338CA',
  indigo800: '#1E1B5E',

  // Success — Emerald
  emerald50: '#ECFDF5',
  emerald400: '#34D399',
  emerald600: '#059669',

  // Warning — Amber
  amber50: '#FFFBEB',
  amber400: '#FBBF24',
  amber600: '#D97706',

  // Danger — Rose
  rose50: '#FFF1F2',
  rose400: '#FB7185',
  rose600: '#E11D48',

  // Info — Sky
  sky50: '#F0F9FF',
  sky400: '#38BDF8',
  sky600: '#0284C7',
} as const;

// Semantic colors (light theme). Dark overrides live in ./darkTokens.
export const colors = {
  ...palette,

  // Neutral surfaces
  background: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceRaised: '#F4F4F3',
  border: '#E8E8E6',
  borderSubtle: '#F0F0EE',

  // Text
  textPrimary: '#0D0D0C',
  textSecondary: '#525250',
  textTertiary: '#9C9C99',
  textInverse: '#FAFAF9',

  // Role aliases (point at the ramp shade the UI uses by default)
  primary: palette.slate900,
  accent: palette.indigo600,
  success: palette.emerald600,
  warning: palette.amber600,
  danger: palette.rose600,
  info: palette.sky600,
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------
// Family names match the keys registered with expo-font in App.tsx. "GeneralSans"
// maps to General Sans (or its Outfit fallback); "JetBrainsMono" is used for
// numbers, stats, and power values to give a sport/tech feel.
export const fontFamily = {
  sans: 'GeneralSans',
  mono: 'JetBrainsMono',
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
