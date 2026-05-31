// Design tokens — the single source of truth for every visual decision in the
// app. Theme: Indigo / Violet (v1.0 MVP brand). Neutral surfaces are indigo-
// tinted rather than pure gray so the whole UI reads as one cohesive palette.
//
// Consume these everywhere instead of hardcoding values. A dark-mode override
// set lives in ./darkTokens; ./useTheme picks the right set at runtime.

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------
export const palette = {
  // Neutral ramp — indigo-tinted (slate* names kept for compatibility).
  slate50: '#F8F7FF',
  slate100: '#F1F0FF',
  slate200: '#E0E7FF',
  slate400: '#818CF8',
  slate600: '#4338CA',
  slate800: '#2D2A5E',
  slate900: '#1E1B4B',

  // Brand — Indigo / Violet (CTA, active states, accents)
  indigo50: '#EEF2FF', // primary-tint
  indigo100: '#C7D2FE',
  indigo400: '#818CF8', // primary-light
  indigo600: '#4F46E5', // primary
  indigo800: '#1E1B4B', // primary-dark

  // Success — Emerald
  emerald50: '#ECFDF5',
  emerald400: '#34D399',
  emerald600: '#10B981',

  // Warning — Amber
  amber50: '#FFFBEB',
  amber400: '#FBBF24',
  amber600: '#F59E0B',

  // Danger — Rose
  rose50: '#FFF1F2',
  rose400: '#FB7185',
  rose600: '#F43F5E',

  // Info — Sky
  sky50: '#F0F9FF',
  sky400: '#38BDF8',
  sky600: '#0EA5E9',
} as const;

// Power-zone colors — theme-independent (used by zone bars, charts, badges).
export const zoneColors = {
  z1: '#CBD5E1', // recovery
  z2: '#818CF8', // endurance
  z3: '#34D399', // tempo
  z4: '#F59E0B', // threshold
  z5: '#F97316', // VO2max
  z6: '#F43F5E', // anaerobic
} as const;

// Semantic colors (light theme). Dark overrides live in ./darkTokens.
export const colors = {
  ...palette,

  // Neutral surfaces (indigo-tinted)
  background: '#F8F7FF',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F0FF',
  border: '#E0E7FF',
  borderSubtle: '#EEF2FF',

  // Text
  textPrimary: '#1E1B4B',
  textSecondary: '#4338CA',
  textTertiary: '#818CF8',
  textInverse: '#FFFFFF',

  // Role aliases
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#1E1B4B',
  primaryTint: '#EEF2FF',
  accent: '#4F46E5',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#F43F5E',
  info: '#0EA5E9',
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
