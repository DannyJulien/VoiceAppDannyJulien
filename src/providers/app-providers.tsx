import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionReviewProvider } from '@/features/actions/action-review-provider';
import { AuthProvider } from '@/features/auth/auth-provider';
import { ThemeProvider } from '@/features/theme/theme-provider';
import { ThemedStatusBar } from '@/components/themed-status-bar';
import { isNetworkTimeoutError } from '@/services/supabase/fetch-with-timeout';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error) => failureCount < 1 && !isNetworkTimeoutError(error),
            staleTime: 30_000,
          },
        },
      }),
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedStatusBar />
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ActionReviewProvider>{children}</ActionReviewProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
