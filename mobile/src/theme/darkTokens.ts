import { colors as lightColors } from './tokens';

// Dark-mode overrides for the Emerald theme. iOS-style near-black surfaces (no
// green tint on neutrals), a lighter emerald accent that pops on black, and a
// deeper emerald for button backgrounds so white labels stay legible.
export const darkColors = {
  ...lightColors,

  // Neutral surfaces — pure/near black, neutral (no green tint).
  background: '#000000',
  surface: '#0F0F0F',
  surfaceRaised: '#1A1A1A',
  surfaceHero: '#111111', // hero card — dark, not green
  border: '#2A2A2A',
  borderSubtle: '#1F1F1F',

  // Text — white on black, neutral greys for secondary/tertiary.
  textPrimary: '#FFFFFF',
  textSecondary: '#A3A3A3',
  textTertiary: '#525252',
  textInverse: '#FFFFFF',

  // Role aliases — deeper emerald for button bg, lighter emerald for accents.
  primary: '#10B981', // button / CTA background (white text legible)
  primaryLight: '#6EE7B7',
  primaryDark: '#065F46',
  primaryTint: '#1A1A1A',
  accent: '#34D399', // links / active tab / text accents — pops on black
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
  info: '#60A5FA',
} as const;

export const DARK_TOKENS = darkColors;

export default darkColors;
