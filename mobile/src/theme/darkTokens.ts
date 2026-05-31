import { colors as lightColors, palette } from './tokens';

// Dark-mode overrides. Neutral surfaces and text flip, and the semantic role
// aliases (primary/accent/success/…) are remapped to LIGHTER ramp shades so
// buttons, links, and status colors keep strong contrast on a dark background
// (the light set's 600 shades are tuned for light backgrounds and go muddy on
// dark). Modern + minimalist: deep neutral surfaces, bright legible accents.
export const darkColors = {
  ...lightColors,

  // Neutral surfaces — layered, not pure black, for subtle depth.
  background: '#0D0D0C',
  surface: '#1A1A19',
  surfaceRaised: '#262625',
  border: '#34342F',
  borderSubtle: '#262624',

  // Text — raised contrast so secondary/tertiary copy stays readable.
  textPrimary: '#F5F5F3',
  textSecondary: '#B4B4B0', // ~8:1 on background
  textTertiary: '#86867F', // ~4.6:1 on background
  textInverse: '#0D0D0C',

  // Semantic roles tuned for dark: light primary + brighter accents.
  primary: palette.slate50,
  accent: palette.indigo400,
  success: palette.emerald400,
  warning: palette.amber400,
  danger: palette.rose400,
  info: palette.sky400,
} as const;

export default darkColors;
