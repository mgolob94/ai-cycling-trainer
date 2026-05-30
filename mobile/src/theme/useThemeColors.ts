import { useColorScheme } from 'react-native';

import { colors as lightColors } from './tokens';

// Dark-mode neutral + text overrides. Accent ramps (indigo/emerald/amber/rose/
// sky) are theme-independent and read directly from `palette`. Prompt 9 will
// promote this into a full Context-based useTheme with a user toggle; for now
// components stay dark-aware via useColorScheme().
const darkColors = {
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

// Widen the literal token types to string so the light and dark sets share one
// structural type.
export type ThemeColors = { [K in keyof typeof lightColors]: string };

/** Resolve the semantic color set for the current system color scheme. */
export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors: ThemeColors = isDark ? darkColors : lightColors;
  return { colors, isDark };
}
