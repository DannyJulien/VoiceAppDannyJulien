import { StyleSheet, Text, View } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

export function ConfigurationNotice() {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View accessibilityRole="alert" style={styles.notice}>
      <Text style={styles.title}>Connect Supabase to continue</Text>
      <Text style={styles.copy}>
        Copy .env.example to .env and add the project URL plus its publishable key. Then restart
        Expo. No test account or mock backend is used here.
      </Text>
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  notice: {
    gap: 6,
    backgroundColor: colors.brandSoft,
    borderColor: colors.focus,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  copy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
