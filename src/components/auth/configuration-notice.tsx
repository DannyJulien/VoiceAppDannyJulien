import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export function ConfigurationNotice() {
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

const styles = StyleSheet.create({
  notice: {
    gap: 6,
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.focus,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  title: { color: Colors.ink, fontSize: 15, fontWeight: '700' },
  copy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
});
