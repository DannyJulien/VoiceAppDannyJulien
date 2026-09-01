import { useState } from 'react';
import { Platform, StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type AppTextInputProps = TextInputProps & {
  /** Paints the border in the danger colour, e.g. after failed validation. */
  invalid?: boolean;
};

/**
 * The one text field of the app. Every screen uses it so the size, colours and
 * focus state cannot drift. The focus state is drawn inside the field (a brand
 * border and a soft inner ring) instead of the browser's outline, which sits
 * outside the box and gets clipped by cards and the screen edge.
 *
 * Pass `style` only for real differences: a surface background on the page
 * canvas, a larger radius, a taller multiline box.
 */
export function AppTextInput({
  invalid = false,
  multiline,
  onBlur,
  onFocus,
  style,
  ...inputProps
}: AppTextInputProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      multiline={multiline}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      placeholderTextColor={colors.muted}
      style={[
        styles.input,
        multiline && styles.multiline,
        style,
        focused && styles.focused,
        invalid && styles.invalid,
      ]}
      {...inputProps}
    />
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    input: {
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    multiline: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
    focused: {
      backgroundColor: colors.surface,
      borderColor: colors.brand,
      // A soft ring just inside the border; inset so nothing can be clipped.
      ...Platform.select({ web: { boxShadow: `inset 0 0 0 2px ${colors.brandSoft}` } }),
    },
    invalid: { borderColor: colors.danger },
  });
