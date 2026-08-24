import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ConfigurationNotice } from '@/components/auth/configuration-notice';
import { FormTextField } from '@/components/form-text-field';
import { Colors } from '@/constants/theme';
import { signUp } from '@/features/auth/auth-service';
import { getFieldErrors, signUpSchema, type SignUpValues } from '@/features/auth/validation';
import { isSupabaseConfigured } from '@/services/supabase/config';

const emptyValues: SignUpValues = { displayName: '', email: '', password: '', confirmPassword: '' };

export default function SignUpScreen() {
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  async function onSubmit() {
    const result = signUpSchema.safeParse(values);
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      await signUp(result.data);
      setConfirmationSent(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to create the account.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}
    >
      <AuthScreen
        eyebrow="GET STARTED"
        title="Say it once. Consider it handled."
        description="Capture the important things without breaking your flow."
      >
        <View style={styles.form}>
          {!isSupabaseConfigured ? <ConfigurationNotice /> : null}
          {confirmationSent ? (
            <View accessibilityRole="alert" style={styles.success}>
              <Text style={styles.successTitle}>Check your inbox</Text>
              <Text style={styles.successCopy}>Confirm your email address, then sign in.</Text>
            </View>
          ) : (
            <>
              <FormTextField
                autoComplete="name"
                onChangeText={(displayName) =>
                  setValues((current) => ({ ...current, displayName }))
                }
                placeholder="Your name"
                value={values.displayName}
                error={errors.displayName}
                label="Name"
              />
              <FormTextField
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onChangeText={(email) => setValues((current) => ({ ...current, email }))}
                placeholder="you@example.com"
                value={values.email}
                error={errors.email}
                label="Email"
              />
              <FormTextField
                autoComplete="new-password"
                onChangeText={(password) => setValues((current) => ({ ...current, password }))}
                placeholder="At least 8 characters"
                secureTextEntry
                value={values.password}
                error={errors.password}
                label="Password"
              />
              <FormTextField
                autoComplete="new-password"
                onChangeText={(confirmPassword) =>
                  setValues((current) => ({ ...current, confirmPassword }))
                }
                placeholder="Repeat your password"
                secureTextEntry
                value={values.confirmPassword}
                error={errors.confirmPassword}
                label="Confirm password"
              />
              {formError ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {formError}
                </Text>
              ) : null}
              <AppButton
                disabled={!isSupabaseConfigured}
                label="Create account"
                loading={isSubmitting}
                onPress={onSubmit}
              />
            </>
          )}
          <Text style={styles.footer}>
            Already have an account?{' '}
            <Link href="/(auth)/sign-in" style={styles.link}>
              Sign in
            </Link>
          </Text>
        </View>
      </AuthScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 16 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  success: { backgroundColor: Colors.brandSoft, borderRadius: 14, padding: 15, gap: 5 },
  successTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  successCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  footer: { color: Colors.muted, fontSize: 15, textAlign: 'center' },
  link: { color: Colors.brand, fontWeight: '800' },
});
