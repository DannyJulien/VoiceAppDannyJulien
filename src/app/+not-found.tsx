import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.copy}>
        <Text style={styles.title}>That page isn’t here.</Text>
        <Text style={styles.description}>Let’s get you back to your capture space.</Text>
        <Link href="/" asChild>
          <AppButton label="Go home" onPress={() => undefined} />
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { justifyContent: 'center' },
  copy: { gap: 14 },
  title: { color: Colors.ink, fontSize: 30, fontWeight: '800' },
  description: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
});
