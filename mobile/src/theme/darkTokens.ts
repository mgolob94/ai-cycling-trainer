import { colors as lightColors } from './tokens';

// Dark-mode overrides for the v1.0 Indigo/Violet theme. Deep indigo-black
// surfaces, soft indigo text, and a bright accent so CTAs, links, and status
// colors stay legible on dark. Modern + minimalist.
export const darkColors = {
  ...lightColors,

  // Neutral surfaces — layered deep indigo, not pure black.
  background: '#0C0B1A',
  surface: '#13112B',
  surfaceRaised: '#1A1840',
  border: '#2D2A5E',
  borderSubtle: '#1A1840',

  // Text — soft indigo tints, high contrast.
  textPrimary: '#EEF2FF',
  textSecondary: '#A5B4FC',
  textTertiary: '#818CF8',
  textInverse: '#FFFFFF',

  // Role aliases — keep the brand indigo CTA, brighten the accent for links.
  primary: '#4F46E5',
  primaryLight: '#818CF8',
  primaryDark: '#1E1B4B',
  primaryTint: '#1A1840',
  accent: '#818CF8',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#FB7185',
  info: '#38BDF8',
} as const;

export default darkColors;
