import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { BackButton } from '@/components/back-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { createContact } from '@/features/contacts/contact-service';
import { contactValidationError } from '@/features/contacts/contact-utils';

export default function NewContactScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const createMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return createContact(userId, { company, email, name, phone });
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
      // Return to the list this screen was opened from; its query is invalidated, so the
      // new person shows there. A deep link or PWA refresh has no history to go back to.
      if (router.canGoBack()) router.back();
      else router.replace('/contacts');
    },
  });

  function saveContact() {
    const error = contactValidationError({ email, name, phone });
    setValidationError(error);
    if (error) return;
    createMutation.mutate();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackHref="/contacts"
          fallbackLabel="‹ People"
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEW PERSON</Text>
          <Text style={styles.title}>Add a person</Text>
          <Text style={styles.copy}>
            An email address or phone number is enough to reach them from a note later.
          </Text>
        </View>
        <View style={styles.form}>
          <AppTextInput
            accessibilityLabel="Contact name"
            autoFocus
            onChangeText={setName}
            placeholder="Name"
            style={styles.input}
            value={name}
          />
          <AppTextInput
            accessibilityLabel="Contact email"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email (optional if phone is present)"
            style={styles.input}
            value={email}
          />
          <AppTextInput
            accessibilityLabel="Contact phone"
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="Phone, e.g. +32470123456 (for WhatsApp)"
            style={styles.input}
            value={phone}
          />
          <AppTextInput
            accessibilityLabel="Contact company"
            onChangeText={setCompany}
            placeholder="Company (optional)"
            style={styles.input}
            value={company}
          />
          {validationError ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {validationError}
            </Text>
          ) : null}
          {createMutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Unable to add this contact.'}
            </Text>
          ) : null}
          <AppButton
            label="Save contact"
            loading={createMutation.isPending}
            onPress={saveContact}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
    back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
    header: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 39,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    form: { gap: 12 },
    input: { backgroundColor: colors.surface, borderRadius: 14 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
