import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors as lightColors, LIGHT_TOKENS } from './tokens';
import { darkColors, DARK_TOKENS } from './darkTokens';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ColorScheme = 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof lightColors]: string };

/** Resolve the token set for a given color scheme. */
export function getTokens(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
}

export { LIGHT_TOKENS, DARK_TOKENS };

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  /** Alias of setMode (matches the documented theme API). */
  changeMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  /** Alias of colors (matches the documented theme API). */
  tokens: ThemeColors;
  resolvedScheme: ColorScheme;
  isDark: boolean;
}

const STORAGE_KEY = 'theme.mode';

// Default (used if a consumer renders outside the provider): light, auto.
const ThemeContext = createContext<ThemeContextValue>({
  mode: 'auto',
  setMode: () => {},
  changeMode: () => {},
  colors: lightColors,
  tokens: lightColors,
  resolvedScheme: 'light',
  isDark: false,
});

/** Wrap the app so every component can read the active theme without prop drilling. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('auto');

  // Restore the saved preference once on mount.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'auto') setModeState(saved);
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  };

  const isDark = mode === 'auto' ? system === 'dark' : mode === 'dark';
  const resolvedScheme: ColorScheme = isDark ? 'dark' : 'light';

  const value = useMemo<ThemeContextValue>(() => {
    const themeColors = isDark ? darkColors : lightColors;
    return {
      mode,
      setMode,
      changeMode: setMode,
      colors: themeColors,
      tokens: themeColors,
      resolvedScheme,
      isDark,
    };
  }, [mode, isDark, resolvedScheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme: { mode, setMode, colors, isDark }. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
