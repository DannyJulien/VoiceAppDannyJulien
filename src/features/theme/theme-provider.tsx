import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';

export type ThemeMode = 'light' | 'dark';

export type AppColors = Readonly<{
  ink: string;
  muted: string;
  canvas: string;
  surface: string;
  border: string;
  brand: string;
  brandPressed: string;
  brandSoft: string;
  danger: string;
  dangerSoft: string;
  focus: string;
  accent: string;
  accentSoft: string;
  nav: string;
  navMuted: string;
}>;

const themeStorageKey = 'handled.theme-mode.v1';

const palettes: Record<ThemeMode, AppColors> = {
  light: {
    ink: '#111827',
    muted: '#667085',
    canvas: '#F7F8FC',
    surface: '#FFFFFF',
    border: '#E4E7EC',
    brand: '#4F46E5',
    brandPressed: '#3730A3',
    brandSoft: '#EEF2FF',
    danger: '#D92D20',
    dangerSoft: '#FEF3F2',
    focus: '#A5B4FC',
    accent: '#F97316',
    accentSoft: '#FFF0E6',
    nav: '#111827',
    navMuted: '#A5B4FC',
  },
  dark: {
    ink: '#F8FAFC',
    muted: '#A8B3C7',
    canvas: '#0B1220',
    surface: '#131D2E',
    border: '#2A3850',
    brand: '#9B95FF',
    brandPressed: '#B6B2FF',
    brandSoft: '#242653',
    danger: '#FF9A93',
    dangerSoft: '#40222D',
    focus: '#7772E8',
    accent: '#FFAE68',
    accentSoft: '#402B1E',
    nav: '#070D18',
    navMuted: '#B9B6FF',
  },
};

type ThemeContextValue = {
  colors: AppColors;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [mode, setModeState] = useState<ThemeMode>('light');

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(themeStorageKey)
      .then((storedMode) => {
        if (!mounted || (storedMode !== 'light' && storedMode !== 'dark')) return;
        setModeState(storedMode);
      })
      .catch(() => undefined);
    return () => {
      mounted = false;
    };
  }, []);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(themeStorageKey, nextMode).catch(() => undefined);
  }, []);

  const value = useMemo(
    () => ({ colors: palettes[mode], mode, setMode }),
    [mode, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider.');
  return context.colors;
}

export function useThemePreference() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useThemePreference must be used inside ThemeProvider.');
  return context;
}
