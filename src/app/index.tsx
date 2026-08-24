import { Redirect } from 'expo-router';

import { LoadingScreen } from '@/components/loading-screen';
import { useAuth } from '@/features/auth/auth-provider';

export default function IndexRoute() {
  const { isReady, session } = useAuth();

  if (!isReady) {
    return <LoadingScreen label="Preparing your space…" />;
  }

  return <Redirect href={session ? '/(app)/home' : '/(auth)/sign-in'} />;
}
