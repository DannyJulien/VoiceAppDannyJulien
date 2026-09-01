import { StyleSheet, Text, View, type TextInputProps } from 'react-native';

import { AppTextInput } from '@/components/app-text-input';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

/** A labelled field for the sign-in and sign-up forms, with an inline error line. */
export function FormTextField({ label, error, ...inputProps }: FormTextFieldProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <AppTextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        invalid={Boolean(error)}
        style={styles.input}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    group: { gap: 7 },
    label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
    // The auth forms sit on the page canvas, so the field is a white surface.
    input: { backgroundColor: colors.surface, borderRadius: 14, minHeight: 54 },
    error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  });
