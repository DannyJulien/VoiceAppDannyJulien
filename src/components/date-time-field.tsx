import type { CSSProperties } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { localDateTimeInputValue } from '@/features/actions/action-utils';
import { type AppColors, useThemePreference } from '@/features/theme/theme-provider';

type DateTimeFieldProps = {
  accessibilityLabel: string;
  /** Called with `YYYY-MM-DDTHH:mm` in device-local time, or '' when cleared. */
  onChange: (value: string) => void;
  /** A stored ISO timestamp, a local `YYYY-MM-DDTHH:mm`, or '' for unset. */
  value: string;
};

/**
 * A date and time picker that never asks the user to type a timestamp.
 *
 * On web (including the iPhone PWA) this renders the browser's own
 * `datetime-local` control, so Safari opens the iOS wheels and Chrome its
 * calendar. React Native's TextInput cannot set an input type, hence the raw
 * element. Native builds fall back to a text field for now; when a real iOS or
 * Android build exists, swap that branch for @react-native-community/datetimepicker.
 */
export function DateTimeField({ accessibilityLabel, onChange, value }: DateTimeFieldProps) {
  const { colors, mode } = useThemePreference();
  const styles = createStyles(colors);

  if (Platform.OS !== 'web') {
    return (
      <TextInput
        accessibilityHint="Example: 2026-08-23 16:30"
        accessibilityLabel={accessibilityLabel}
        onChangeText={onChange}
        placeholder="2026-08-23 16:30"
        placeholderTextColor={colors.muted}
        style={styles.input}
        value={value}
      />
    );
  }

  const webInput: CSSProperties = {
    backgroundColor: colors.canvas,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    boxSizing: 'border-box',
    color: colors.ink,
    // Makes the browser's picker popup and icon follow the app theme.
    colorScheme: mode,
    flex: 1,
    fontFamily: 'inherit',
    fontSize: 16,
    minHeight: 52,
    minWidth: 0,
    outlineColor: colors.focus,
    padding: '0 14px',
  };

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <input
          aria-label={accessibilityLabel}
          onChange={(event) => onChange(event.target.value)}
          style={webInput}
          type="datetime-local"
          value={localDateTimeInputValue(value)}
        />
        {value ? (
          <AppButton
            accessibilityHint="Removes the date and time."
            label="Clear"
            onPress={() => onChange('')}
            style={styles.clear}
            variant="quiet"
          />
        ) : null}
      </View>
      {value ? null : <Text style={styles.hint}>Tap the field to pick a date and time.</Text>}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    stack: { gap: 6 },
    row: { alignItems: 'center', flexDirection: 'row', gap: 8 },
    clear: { minHeight: 52, paddingHorizontal: 12 },
    hint: { color: colors.muted, fontSize: 13, lineHeight: 18 },
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
  });
