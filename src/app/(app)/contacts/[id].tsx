import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { IconButton } from '@/components/icon-button';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { actionTypeLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { contactLabel, contactValidationError } from '@/features/contacts/contact-utils';
import {
  deleteContact,
  getContact,
  getContactTimeline,
  updateContact,
} from '@/features/contacts/contact-service';
import { categoryDetails } from '@/features/projects/project-utils';

export default function ContactTimelineScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const contactQuery = useQuery({
    queryKey: ['contact', id, userId],
    queryFn: () => getContact(id, userId!),
    enabled: Boolean(id && userId),
  });
  const timelineQuery = useQuery({
    queryKey: ['contact-timeline', id, userId],
    queryFn: () => getContactTimeline(id, userId!),
    enabled: Boolean(id && userId),
  });
  const contact = contactQuery.data;
  const updateMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return updateContact(id, userId, { company, email, name, phone });
    },
    onSuccess: () => {
      setEditing(false);
      setValidationError(null);
      queryClient.invalidateQueries({ queryKey: ['contact', id, userId] });
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return deleteContact(id, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
      router.replace('/contacts');
    },
  });

  /** Copies the saved person into the form so the fields start from what is stored. */
  function startEditing() {
    if (!contact) return;
    setName(contact.name);
    setEmail(contact.email ?? '');
    setPhone(contact.phone ?? '');
    setCompany(contact.company ?? '');
    setValidationError(null);
    setEditing(true);
  }

  function savePerson() {
    const error = contactValidationError({ email, name, phone });
    setValidationError(error);
    if (error) return;
    updateMutation.mutate();
  }

  if (contactQuery.isPending)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.copy}>Loading person…</Text>
      </Screen>
    );
  if (!contact)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>Person unavailable</Text>
        <AppButton label="Back to people" onPress={() => router.replace('/contacts')} />
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton
          label="‹ People"
          onPress={() => router.replace('/contacts')}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CONVERSATION TIMELINE</Text>
          <Text style={styles.title}>{contact.name}</Text>
          <Text style={styles.copy}>{contactLabel(contact)}</Text>
        </View>
        {editing ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Edit this person</Text>
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
            {updateMutation.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : 'Unable to save this person.'}
              </Text>
            ) : null}
            <AppButton
              label="Save changes"
              loading={updateMutation.isPending}
              onPress={savePerson}
            />
            <AppButton label="Cancel" onPress={() => setEditing(false)} variant="quiet" />
          </View>
        ) : confirmingDeletion ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Delete {contact.name}?</Text>
            <Text style={styles.confirmCopy}>
              Notes you wrote stay, they just lose the link to this person.
            </Text>
            <View style={styles.confirmRow}>
              <AppButton
                label="Delete"
                loading={deleteMutation.isPending}
                onPress={() => deleteMutation.mutate()}
                style={styles.confirmDelete}
              />
              <AppButton
                label="Cancel"
                onPress={() => setConfirmingDeletion(false)}
                style={styles.confirmCancel}
                variant="secondary"
              />
            </View>
            {deleteMutation.error ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {deleteMutation.error instanceof Error
                  ? deleteMutation.error.message
                  : 'Unable to delete this person.'}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.actions}>
            <IconButton
              accessibilityLabel={`Add a note about ${contact.name}`}
              label="Add note"
              onPress={() =>
                router.push({ pathname: '/note/new', params: { contactId: contact.id } })
              }
              renderIcon={(color, size) => <PlusIcon color={color} size={size} />}
            />
            <View style={styles.actionsRight}>
              <IconButton
                accessibilityLabel={`Edit ${contact.name}`}
                onPress={startEditing}
                renderIcon={(color, size) => <PencilIcon color={color} size={size} />}
              />
              <IconButton
                accessibilityLabel={`Delete ${contact.name}`}
                onPress={() => setConfirmingDeletion(true)}
                renderIcon={(color, size) => <TrashIcon color={color} size={size} />}
                tone="danger"
              />
            </View>
          </View>
        )}
        {timelineQuery.isPending ? <Text style={styles.copy}>Loading conversation…</Text> : null}
        {timelineQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notes with {contact.name} yet</Text>
            <Text style={styles.copy}>
              When you connect a note to this person, it will appear here in order.
            </Text>
          </View>
        ) : null}
        <View style={styles.timeline}>
          {timelineQuery.data?.map((action) => {
            const category = categoryDetails(action.category);
            return (
              <View key={action.id} style={styles.eventRow}>
                <View style={[styles.dot, { backgroundColor: category.color }]} />
                <View style={styles.event}>
                  <Text style={[styles.category, { color: category.color }]}>
                    {category.label} · {actionTypeLabel(action.action_type)}
                  </Text>
                  <Text style={styles.eventTitle}>{action.title}</Text>
                  {action.summary ? (
                    <Text numberOfLines={2} style={styles.eventCopy}>
                      {action.summary}
                    </Text>
                  ) : null}
                  <Text style={styles.date}>{new Date(action.created_at).toLocaleString()}</Text>
                  <AppButton
                    label="Open note"
                    onPress={() =>
                      router.push({ pathname: '/action/[id]', params: { id: action.id } })
                    }
                    style={styles.open}
                    variant="quiet"
                  />
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
  center: { gap: 14, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  header: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: Colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
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
  actions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  actionsRight: { flexDirection: 'row', gap: 10 },
  confirmCard: {
    backgroundColor: Colors.dangerSoft,
    borderColor: Colors.danger,
    borderRadius: 20,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  confirmTitle: { color: Colors.ink, fontSize: 17, fontWeight: '900' },
  confirmCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  confirmRow: { flexDirection: 'row', gap: 10 },
  confirmDelete: { backgroundColor: Colors.danger, flex: 1 },
  confirmCancel: { flex: 1 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  empty: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  emptyTitle: { color: Colors.ink, fontSize: 19, fontWeight: '900' },
  timeline: { gap: 2 },
  eventRow: { flexDirection: 'row', gap: 12 },
  dot: {
    borderColor: Colors.canvas,
    borderRadius: 8,
    borderWidth: 4,
    height: 16,
    marginTop: 18,
    width: 16,
  },
  event: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    marginBottom: 11,
    padding: 15,
  },
  category: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  eventTitle: { color: Colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 23 },
  eventCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  date: { color: Colors.muted, fontSize: 12 },
  open: { alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 0 },
});
