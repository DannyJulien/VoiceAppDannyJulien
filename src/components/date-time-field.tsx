import { useState, type CSSProperties } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
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
  const [focused, setFocused] = useState(false);

  if (Platform.OS !== 'web') {
    return (
      <AppTextInput
        accessibilityHint="Example: 2026-08-23 16:30"
        accessibilityLabel={accessibilityLabel}
        onChangeText={onChange}
        placeholder="2026-08-23 16:30"
        value={value}
      />
    );
  }

  // Mirrors AppTextInput, including its in-box focus state; the browser outline is
  // switched off globally in global.css.
  const webInput: CSSProperties = {
    backgroundColor: focused ? colors.surface : colors.canvas,
    border: `1px solid ${focused ? colors.brand : colors.border}`,
    borderRadius: 12,
    boxShadow: focused ? `inset 0 0 0 2px ${colors.brandSoft}` : undefined,
    boxSizing: 'border-box',
    color: colors.ink,
    // Makes the browser's picker popup and icon follow the app theme.
    colorScheme: mode,
    flex: 1,
    fontFamily: 'inherit',
    fontSize: 16,
    minHeight: 52,
    minWidth: 0,
    padding: '0 14px',
  };

  return (
    <View style={styles.stack}>
      <View style={styles.row}>
        <input
          aria-label={accessibilityLabel}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setFocused(true)}
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
  });
