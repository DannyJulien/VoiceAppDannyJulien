import { StyleSheet, View } from 'react-native';
import { Redirect, Stack } from 'expo-router';

import { HeaderActions } from '@/components/header-actions';
import { LoadingScreen } from '@/components/loading-screen';
import { MobileNavigation } from '@/components/mobile-navigation';
import { useAuth } from '@/features/auth/auth-provider';

export default function AppLayout() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return <LoadingScreen label="Checking your account…" />;
  }

  if (!session) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
        <HeaderActions />
      </View>
      <MobileNavigation />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 }, stack: { flex: 1 } });
