import { type PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Layout } from '@/constants/theme';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type ScreenProps = PropsWithChildren<{
  contentStyle?: ViewStyle;
}>;

// Only the top edge is padded: the floating tab bar owns the bottom safe area,
// and scrolling content pads itself with useTabBarInset().
export function Screen({ children, contentStyle }: ScreenProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: Layout.contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: Layout.horizontalPadding,
  },
});
