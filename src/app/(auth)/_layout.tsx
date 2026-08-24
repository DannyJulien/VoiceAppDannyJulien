import { Redirect, Stack } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';

export default function AuthLayout() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return <LoadingScreen label="Checking your session…" />;
  }

  if (session) {
    return <Redirect href="/(app)/home" />;
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }} />;
}
