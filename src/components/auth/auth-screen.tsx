import { type PropsWithChildren } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';

type AuthScreenProps = PropsWithChildren<{
  eyebrow: string;
  title: string;
  description: string;
}>;

export function AuthScreen({ eyebrow, title, description, children }: AuthScreenProps) {
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

const styles = StyleSheet.create({
  content: { justifyContent: 'center', gap: 34 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.brand },
  brand: { color: Colors.ink, fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  copy: { gap: 10 },
  eyebrow: { color: Colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  title: {
    color: Colors.ink,
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  description: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
});
