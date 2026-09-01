import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type AppButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'quiet';
  style?: ViewStyle;
  accessibilityHint?: string;
};

export function AppButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  accessibilityHint,
}: AppButtonProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const isDisabled = disabled || loading;
  const isPrimary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'quiet' && styles.quiet,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.onBrand : colors.brand} />
      ) : (
        <Text style={[styles.label, isPrimary ? styles.primaryLabel : styles.secondaryLabel]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    base: {
      minHeight: 50,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: 16,
      paddingHorizontal: 18,
    },
    primary: {
      backgroundColor: colors.brand,
      borderColor: colors.brand,
      borderWidth: 1,
      boxShadow: `0px 5px 12px ${colors.brand}2E`,
    },
    secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
    quiet: { backgroundColor: 'transparent' },
    pressed: { opacity: 0.86 },
    disabled: { opacity: 0.48 },
    label: { fontSize: 15, fontWeight: '800' },
    primaryLabel: { color: colors.onBrand },
    secondaryLabel: { color: colors.brand },
  });
