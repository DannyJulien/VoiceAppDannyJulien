import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function FormTextField({ label, error, ...inputProps }: FormTextFieldProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={colors.muted}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  group: { gap: 7 },
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 54,
    backgroundColor: colors.surface,
    color: colors.ink,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 13, lineHeight: 18 },
});
