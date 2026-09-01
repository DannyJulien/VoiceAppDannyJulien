import { type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type AuthScreenProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function AuthScreen({ eyebrow, title, description, children }: AuthScreenProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.mark} />
        <Text style={styles.brand}>Handled</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.eyebrow}>{eyebrow}</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      {children}
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { justifyContent: 'center', gap: 30 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    mark: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brand },
    brand: { color: colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
    copy: { gap: 10 },
    eyebrow: { color: colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
    title: {
      color: colors.ink,
      fontSize: 34,
      lineHeight: 40,
      fontWeight: '800',
      letterSpacing: -1.2,
    },
    description: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  });
