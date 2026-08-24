import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ConfigurationNotice } from '@/components/auth/configuration-notice';
import { FormTextField } from '@/components/form-text-field';
import { Colors } from '@/constants/theme';
import { signIn } from '@/features/auth/auth-service';
import { getFieldErrors, signInSchema, type SignInValues } from '@/features/auth/validation';
import { isSupabaseConfigured } from '@/services/supabase/config';

const emptyValues: SignInValues = { email: '', password: '' };

export default function SignInScreen() {
  const router = useRouter();
  const [values, setValues] = useState(emptyValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit() {
    const result = signInSchema.safeParse(values);
    if (!result.success) {
      setErrors(getFieldErrors(result.error));
      return;
    }

    setErrors({});
    setFormError(null);
    setIsSubmitting(true);
    try {
      await signIn(result.data);
      router.replace('/(app)/home');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
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
        eyebrow="WELCOME BACK"
        title="One thought. One clear next step."
        description="Sign in to pick up exactly where you left off."
      >
        <View style={styles.form}>
          {!isSupabaseConfigured ? <ConfigurationNotice /> : null}
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
            autoComplete="current-password"
            onChangeText={(password) => setValues((current) => ({ ...current, password }))}
            placeholder="Your password"
            secureTextEntry
            value={values.password}
            error={errors.password}
            label="Password"
          />
          {formError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {formError}
            </Text>
          ) : null}
          <AppButton
            disabled={!isSupabaseConfigured}
            label="Sign in"
            loading={isSubmitting}
            onPress={onSubmit}
          />
          <Text style={styles.footer}>
            New here?{' '}
            <Link href="/(auth)/sign-up" style={styles.link}>
              Create an account
            </Link>
          </Text>
        </View>
      </AuthScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  form: { gap: 18 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  footer: { color: Colors.muted, fontSize: 15, textAlign: 'center' },
  link: { color: Colors.brand, fontWeight: '800' },
});
