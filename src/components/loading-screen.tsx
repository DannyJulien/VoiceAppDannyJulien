import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { Screen } from '@/components/screen';

export function LoadingScreen({ label }: { label: string }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.group}>
        <ActivityIndicator color={colors.brand} size="large" />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  content: { justifyContent: 'center' },
  group: { alignItems: 'center', gap: 16 },
  label: { color: colors.muted, fontSize: 16 },
});
