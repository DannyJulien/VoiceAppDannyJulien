import { StatusBar } from 'expo-status-bar';

import { useThemePreference } from '@/features/theme/theme-provider';

export function ThemedStatusBar() {
  const { mode } = useThemePreference();
  return <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />;
}
