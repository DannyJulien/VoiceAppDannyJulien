import type { ReactElement } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type IconButtonProps = {
  /** Called with the resolved colour, so the icon always matches the button's tone. */
  renderIcon: (color: string, size: number) => ReactElement;
  /** Spoken name of the control. Always required, because the icon alone says nothing. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Optional visible text next to the icon, for actions a symbol cannot carry alone. */
  label?: string;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

const ICON_SIZE = 20;

/**
 * Compact square (or pill, when `label` is set) action button. Used where a full-width
 * AppButton would push the actual content off the screen.
 */
export function IconButton({
  renderIcon,
  accessibilityLabel,
  onPress,
  label,
  tone = 'neutral',
  disabled = false,
  style,
}: IconButtonProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const isDanger = tone === 'danger';
  const color = isDanger ? colors.danger : colors.brand;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        label ? styles.pill : styles.square,
        isDanger && styles.danger,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {renderIcon(color, ICON_SIZE)}
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </Pressable>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  square: { borderRadius: 14, height: 44, width: 44 },
  pill: { borderRadius: 999, minHeight: 44, paddingHorizontal: 16 },
  danger: { backgroundColor: colors.dangerSoft, borderColor: '#FBD3CE' },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.48 },
  label: { fontSize: 15, fontWeight: '800' },
});
