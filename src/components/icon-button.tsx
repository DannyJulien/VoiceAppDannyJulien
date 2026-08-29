import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Colors } from '@/constants/theme';

type IconButtonProps = {
  /** Unicode glyph, matching the icon language used by the tab bar and the Inbox button. */
  icon: string;
  /** Spoken name of the control. Always required, because the glyph alone says nothing. */
  accessibilityLabel: string;
  onPress: () => void;
  /** Optional visible text next to the glyph, for icons that need a word to be understood. */
  label?: string;
  tone?: 'neutral' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
};

/**
 * Compact square (or pill, when `label` is set) action button. Used where a full-width
 * AppButton would push the actual content off the screen.
 */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  label,
  tone = 'neutral',
  disabled = false,
  style,
}: IconButtonProps) {
  const color = tone === 'danger' ? Colors.danger : Colors.brand;

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
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.icon, { color }]}>{icon}</Text>
      {label ? <Text style={[styles.label, { color }]}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
  },
  square: { borderRadius: 14, height: 44, width: 44 },
  pill: { borderRadius: 999, minHeight: 44, paddingHorizontal: 16 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.48 },
  icon: { fontSize: 18, fontWeight: '900', lineHeight: 22 },
  label: { fontSize: 15, fontWeight: '800' },
});
