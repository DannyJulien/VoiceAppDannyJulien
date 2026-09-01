import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { BackButton } from '@/components/back-button';
import { IconButton } from '@/components/icon-button';
import { MailIcon, MessageIcon, UsersIcon } from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getAction, updateAction } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import {
  openEmailComposer,
  openSmsComposer,
  openWhatsAppComposer,
} from '@/features/contacts/contact-delivery';
import { contactLabel } from '@/features/contacts/contact-utils';
import {
  addActionRecipient,
  getActionRecipients,
  getContacts,
} from '@/features/contacts/contact-service';

export default function SendActionScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [editedDraft, setEditedDraft] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const contactsQuery = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getContacts(userId!),
    enabled: Boolean(userId),
  });
  const recipientsQuery = useQuery({
    queryKey: ['action-recipients', id, userId],
    queryFn: () => getActionRecipients(id, userId!),
    enabled: Boolean(id && userId),
  });
  const action = actionQuery.data;
  const draft = editedDraft ?? action?.message_draft ?? '';
  const selectedContact =
    contactsQuery.data?.find((contact) => contact.id === selectedContactId) ?? null;
  const recipient =
    recipientsQuery.data?.find((contact) => contact.id === selectedContactId) ??
    recipientsQuery.data?.[0] ??
    null;

  const recipientMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId) throw new Error('Choose a contact first.');
      return addActionRecipient(id, selectedContactId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['action-recipients', id, userId] });
    },
  });
  const draftMutation = useMutation({
    mutationFn: (nextDraft: string) => {
      if (!userId) throw new Error('You need to be signed in.');
      return updateAction(id, userId, { message_draft: nextDraft.trim() || null });
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
        queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
      }
    },
  });

  if (actionQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Loading note…</Text>
      </Screen>
    );
  }
  if (actionQuery.error || !action) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Note unavailable</Text>
        <Text style={styles.copy}>
          It may have been removed or you no longer have access to it.
        </Text>
        <BackButton fallbackHref="/timeline" fallbackLabel="Back to timeline" label="Go back" />
      </Screen>
    );
  }

  // Opened from a deep link or a PWA refresh there is no history to go back to.
  function backToNote() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/action/[id]', params: { id } });
  }

  function prepareDelivery(channel: 'email' | 'sms' | 'whatsapp') {
    if (!recipient || !action) {
      setDeliveryError('Choose a contact before preparing a message.');
      return;
    }

    setDeliveryError(null);
    // The composer gets whatever is in the draft box right now; persist it too so the
    // note keeps the version that was actually sent.
    if (draft.trim() !== (action.message_draft ?? '').trim()) draftMutation.mutate(draft);
    const message = draft.trim() || action.summary?.trim() || action.title;
    const operation =
      channel === 'email'
        ? openEmailComposer(recipient, action.title, message)
        : channel === 'sms'
          ? openSmsComposer(recipient, message)
          : openWhatsAppComposer(recipient, message);

    void operation.catch((deliveryFailure: unknown) => {
      setDeliveryError(
        deliveryFailure instanceof Error
          ? deliveryFailure.message
          : 'Unable to open the selected messaging app.',
      );
    });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label="‹ Note"
          onPress={backToNote}
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>SEND TO A CONTACT</Text>
        <Text style={styles.title}>{action.title}</Text>
        <Text style={styles.copy}>
          Pick a person, adjust the message, then continue in their preferred messaging app.
        </Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Contact</Text>
          {contactsQuery.data?.length ? (
            <ScrollView
              contentContainerStyle={styles.contactChoices}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {contactsQuery.data.map((contact) => {
                const selected = selectedContactId === contact.id;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    key={contact.id}
                    onPress={() => setSelectedContactId(contact.id)}
                    style={[styles.contactChoice, selected && styles.selectedContact]}
                  >
                    <Text
                      style={[styles.contactChoiceText, selected && styles.selectedContactText]}
                    >
                      {contact.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.copy}>Add a contact before preparing a message.</Text>
          )}
          <View style={styles.compactActions}>
            <IconButton
              accessibilityLabel="Manage contacts"
              label="Manage"
              onPress={() => router.push('/contacts')}
              renderIcon={(color, size) => <UsersIcon color={color} size={size} />}
            />
            {selectedContact &&
            !recipientsQuery.data?.some((contact) => contact.id === selectedContact.id) ? (
              <IconButton
                accessibilityLabel={`Use ${selectedContact.name} for this note`}
                label={`Use ${selectedContact.name}`}
                onPress={() => recipientMutation.mutate()}
                renderIcon={(color, size) => <UsersIcon color={color} size={size} />}
              />
            ) : null}
          </View>
          <Text style={styles.fieldLabel}>Message</Text>
          <AppTextInput
            accessibilityHint="Leave empty to send the note summary or title."
            accessibilityLabel="Message draft"
            multiline
            onChangeText={setEditedDraft}
            placeholder={action.summary?.trim() || action.title}
            value={draft}
          />
        </View>

        {recipient ? (
          <View style={styles.recipientRow}>
            <Text style={styles.recipient}>{contactLabel(recipient)}</Text>
            <View style={styles.deliveryShortcuts}>
              {recipient.phone ? (
                <>
                  <IconButton
                    accessibilityLabel={`Open WhatsApp for ${recipient.name}`}
                    label="WhatsApp"
                    onPress={() => prepareDelivery('whatsapp')}
                    renderIcon={(color, size) => <MessageIcon color={color} size={size} />}
                  />
                  <IconButton
                    accessibilityLabel={`Open SMS composer for ${recipient.name}`}
                    label="SMS"
                    onPress={() => prepareDelivery('sms')}
                    renderIcon={(color, size) => <MessageIcon color={color} size={size} />}
                  />
                </>
              ) : null}
              {recipient.email ? (
                <IconButton
                  accessibilityLabel={`Open email composer for ${recipient.name}`}
                  label="Email"
                  onPress={() => prepareDelivery('email')}
                  renderIcon={(color, size) => <MailIcon color={color} size={size} />}
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {deliveryError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {deliveryError}
          </Text>
        ) : null}
        {recipientMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {recipientMutation.error instanceof Error
              ? recipientMutation.error.message
              : 'Unable to save this recipient.'}
          </Text>
        ) : null}
        {draftMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Unable to save the message draft.
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 16, paddingVertical: 20 },
    centered: { gap: 16, justifyContent: 'center' },
    back: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 0 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.7,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 18,
    },
    fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
    compactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    contactChoices: { gap: 8, paddingRight: 4 },
    contactChoice: {
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 999,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 42,
      paddingHorizontal: 13,
    },
    contactChoiceText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    selectedContact: { backgroundColor: colors.brand, borderColor: colors.brand },
    selectedContactText: { color: colors.surface },
    recipient: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
    recipientRow: {
      backgroundColor: colors.canvas,
      borderRadius: 14,
      gap: 10,
      padding: 12,
    },
    deliveryShortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
