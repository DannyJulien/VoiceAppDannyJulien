import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SystemUI from 'expo-system-ui';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

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
  onBrand: string;
  onBrandMuted: string;
}>;

const themeStorageKey = 'handled.theme-mode.v1';

const palettes: Record<ThemeMode, AppColors> = {
  light: {
    ink: '#142033',
    muted: '#5D6B82',
    canvas: '#F5F7FB',
    surface: '#FFFFFF',
    border: '#DDE5F0',
    brand: '#2563EB',
    brandPressed: '#1D4ED8',
    brandSoft: '#EAF1FF',
    danger: '#B42318',
    dangerSoft: '#FFF1F0',
    focus: '#93B4FF',
    accent: '#0F9F8A',
    accentSoft: '#E7F8F4',
    nav: '#12213D',
    navMuted: '#B9C8E3',
    onBrand: '#FFFFFF',
    onBrandMuted: '#DBEAFE',
  },
  dark: {
    ink: '#F5F8FC',
    muted: '#B4C0D2',
    canvas: '#091322',
    surface: '#111E30',
    border: '#273A55',
    brand: '#86B4FF',
    brandPressed: '#B8D2FF',
    brandSoft: '#1C3154',
    danger: '#FFA8A0',
    dangerSoft: '#48232B',
    focus: '#5C8EE5',
    accent: '#63D6C3',
    accentSoft: '#153A39',
    nav: '#070F1D',
    navMuted: '#B7C7E6',
    onBrand: '#071525',
    onBrandMuted: '#D7E6FF',
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

  useEffect(() => {
    // The root view sits behind the top safe area on native. Keep it in sync with
    // the active palette so no static light strip appears above a dark screen.
    void SystemUI.setBackgroundColorAsync(palettes[mode].canvas).catch(() => undefined);
  }, [mode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);
    void AsyncStorage.setItem(themeStorageKey, nextMode).catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ colors: palettes[mode], mode, setMode }), [mode, setMode]);

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
