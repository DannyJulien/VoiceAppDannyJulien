import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Colors } from '@/constants/theme';

type FormTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function FormTextField({ label, error, ...inputProps }: FormTextFieldProps) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error}
        placeholderTextColor={Colors.muted}
        style={[styles.input, error && styles.inputError]}
        {...inputProps}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 7 },
  label: { color: Colors.ink, fontSize: 15, fontWeight: '600' },
  input: {
    minHeight: 54,
    backgroundColor: Colors.surface,
    color: Colors.ink,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 15,
    fontSize: 16,
  },
  inputError: { borderColor: Colors.danger },
  error: { color: Colors.danger, fontSize: 13, lineHeight: 18 },
});
