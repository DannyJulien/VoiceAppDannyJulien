import { StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';

import { MobileNavigation } from '@/components/mobile-navigation';

export default function AppLayout() {
  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </View>
      <MobileNavigation />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, stack: { flex: 1 } });
