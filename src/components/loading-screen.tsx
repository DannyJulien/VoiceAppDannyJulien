import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { Screen } from '@/components/screen';

export function LoadingScreen({ label }: { label: string }) {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.group}>
        <ActivityIndicator color={Colors.brand} size="large" />
        <Text style={styles.label}>{label}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  group: { alignItems: 'center', gap: 16 },
  label: { color: Colors.muted, fontSize: 16 },
});
