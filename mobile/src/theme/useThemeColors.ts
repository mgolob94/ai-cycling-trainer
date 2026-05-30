import { useTheme, type ThemeColors } from './useTheme';

export type { ThemeColors };

/**
 * Backwards-compatible accessor for components built before the theme Context.
 * Delegates to useTheme so they respect the user's auto/light/dark preference.
 */
export function useThemeColors(): { colors: ThemeColors; isDark: boolean } {
  const { colors, isDark } = useTheme();
  return { colors, isDark };
}
