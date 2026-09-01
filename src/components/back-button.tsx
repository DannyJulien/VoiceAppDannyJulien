import { type ViewStyle } from 'react-native';
import { type Href, useRouter } from 'expo-router';

import { AppButton } from '@/components/app-button';

type BackButtonProps = {
  fallbackHref: Href;
  fallbackLabel: string;
  label?: string;
  style?: ViewStyle;
  variant?: 'primary' | 'secondary' | 'quiet';
};

// A real back action: it returns to wherever the screen was pushed from, and only
// jumps to fallbackHref when there is no history (deep link, PWA refresh). The label
// names a destination only when the fallback is what will actually happen.
export function BackButton({
  fallbackHref,
  fallbackLabel,
  label = '‹ Back',
  style,
  variant,
}: BackButtonProps) {
  const router = useRouter();
  const canGoBack = router.canGoBack();
  return (
    <AppButton
      label={canGoBack ? label : fallbackLabel}
      onPress={() => (canGoBack ? router.back() : router.replace(fallbackHref))}
      style={style}
      variant={variant}
    />
  );
}
