import { StatusBar } from 'react-native';

import { useThemePreference } from '@/features/theme/theme-provider';

export function ThemedStatusBar() {
  const { colors, mode } = useThemePreference();
  return (
    <StatusBar
      backgroundColor={colors.canvas}
      barStyle={mode === 'dark' ? 'light-content' : 'dark-content'}
      translucent={false}
    />
  );
}
