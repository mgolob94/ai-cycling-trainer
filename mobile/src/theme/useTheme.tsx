import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { colors as lightColors } from './tokens';
import { darkColors } from './darkTokens';

export type ThemeMode = 'auto' | 'light' | 'dark';
export type ThemeColors = { [K in keyof typeof lightColors]: string };

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ThemeColors;
  isDark: boolean;
}

const STORAGE_KEY = 'theme.mode';

// Default (used if a consumer renders outside the provider): light, auto.
const ThemeContext = createContext<ThemeContextValue>({
  mode: 'auto',
  setMode: () => {},
  colors: lightColors,
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

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, setMode, colors: isDark ? darkColors : lightColors, isDark }),
    [mode, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Access the active theme: { mode, setMode, colors, isDark }. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
