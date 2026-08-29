import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { contactLabel, contactValidationError } from '@/features/contacts/contact-utils';
import { createContact, getContacts } from '@/features/contacts/contact-service';
import { useAuth } from '@/features/auth/auth-provider';

export default function ContactsScreen() {
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
  const contactsQuery = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getContacts(userId!),
    enabled: Boolean(userId),
  });
  const createMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return createContact(userId, { company, email, name, phone });
    },
    onSuccess: () => {
      setCompany('');
      setEmail('');
      setName('');
      setPhone('');
      setValidationError(null);
      if (userId) queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
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
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]} keyboardShouldPersistTaps="handled">
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR PEOPLE</Text>
          <Text style={styles.title}>People</Text>
        </View>
        <Text style={styles.copy}>
          Save someone once. From a note, you can open WhatsApp, SMS, or an email to them.
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add a person</Text>
          <TextInput
            accessibilityLabel="Contact name"
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={name}
          />
          <TextInput
            accessibilityLabel="Contact email"
            autoCapitalize="none"
            keyboardType="email-address"
            onChangeText={setEmail}
            placeholder="Email (optional if phone is present)"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={email}
          />
          <TextInput
            accessibilityLabel="Contact phone"
            keyboardType="phone-pad"
            onChangeText={setPhone}
            placeholder="Phone, e.g. +32470123456 (for WhatsApp)"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={phone}
          />
          <TextInput
            accessibilityLabel="Contact company"
            onChangeText={setCompany}
            placeholder="Company (optional)"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={company}
          />
          {validationError ? <Text style={styles.error}>{validationError}</Text> : null}
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

        <Text style={styles.listTitle}>Saved contacts</Text>
        {contactsQuery.isPending ? <Text style={styles.copy}>Loading contacts…</Text> : null}
        {contactsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {contactsQuery.error instanceof Error
                ? contactsQuery.error.message
                : 'Unable to load contacts.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => contactsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {contactsQuery.data?.length === 0 ? (
          <Text style={styles.copy}>No contacts yet. Add one above when you are ready.</Text>
        ) : null}
        <View style={styles.list}>
          {contactsQuery.data?.map((contact) => (
            <Pressable
              accessibilityLabel={`Open ${contact.name}`}
              accessibilityRole="button"
              key={contact.id}
              onPress={() =>
                router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })
              }
              style={({ pressed }) => [styles.contactCard, pressed && styles.pressed]}
            >
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactDetails}>{contactLabel(contact)}</Text>
              <Text style={styles.timelineLink}>Timeline ›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
  titleBlock: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 2 },
  input: {
    backgroundColor: Colors.canvas,
    borderColor: Colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: Colors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  listTitle: { color: Colors.ink, fontSize: 19, fontWeight: '900', marginTop: 4 },
  list: { gap: 9 },
  contactCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 15,
  },
  contactName: { color: Colors.ink, fontSize: 17, fontWeight: '800' },
  contactDetails: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  timelineLink: { color: Colors.brand, fontSize: 13, fontWeight: '800', marginTop: 4 },
  pressed: { opacity: 0.8 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  errorCard: { gap: 10 },
});
