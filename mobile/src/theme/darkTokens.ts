import { colors as lightColors } from './tokens';

// Dark-mode overrides — athletic / Strava-inspired. True warm black surfaces,
// green used sparingly, achievement orange brighter for dark backgrounds.
export const darkColors = {
  ...lightColors,

  // Neutral surfaces — true black with a warm tint.
  background: '#0A0A09',
  surface: '#141413',
  surfaceRaised: '#1C1C1B',
  surfaceHero: '#141413', // hero / form / FTP card — dark, not green
  border: '#222221',
  borderSubtle: '#1C1C1B',

  // Text — warm white, neutral greys.
  textPrimary: '#F0EFEB',
  textSecondary: '#787876',
  textTertiary: '#3A3A38',
  textInverse: '#0A0A09', // text on the lighter green primary

  // Role aliases — lighter green pops on black.
  primary: '#34D399',
  primaryLight: '#6EE7B7',
  primaryDark: '#065F46',
  primaryTint: '#1C1C1B',
  accent: '#34D399',
  success: '#34D399',
  warning: '#FBBF24',
  danger: '#F87171',
  info: '#60A5FA',

  // Athletic aliases
  bg: '#0A0A09',
  surfaceAlt: '#1C1C1B',
  surfaceDark: '#0A0A09',
  textDim: '#3A3A38',
  green: '#34D399',
  greenLight: 'rgba(52,211,153,0.12)',
  greenDim: 'rgba(52,211,153,0.06)',
  achievement: '#FF5733',
  achievementBg: 'rgba(255,87,51,0.12)',
} as const;

export const DARK_TOKENS = darkColors;

export default darkColors;
