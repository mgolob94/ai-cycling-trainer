import { colors as lightColors } from './tokens';

// Dark-mode overrides. Accent ramps (indigo/emerald/amber/rose/sky) are
// theme-independent and carried over from the light set; only neutral surfaces
// and text flip. The dark hero card uses an elevated dark surface (not pure
// black) for subtle depth.
export const darkColors = {
  ...lightColors,

  background: '#0D0D0C',
  surface: '#1A1A19',
  surfaceRaised: '#242423',
  border: '#2E2E2C',
  borderSubtle: '#222221',

  textPrimary: '#F4F4F2',
  textSecondary: '#9C9C99',
  textTertiary: '#5C5C5A',
  textInverse: '#0D0D0C',
} as const;

export default darkColors;
