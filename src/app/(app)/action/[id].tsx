import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import {
  deleteAction,
  getAction,
  getCaptureTranscript,
  setActionStatus,
  updateAction,
} from '@/features/actions/action-service';
import {
  actionTypeLabel,
  formatActionWhen,
  normalizedSchedule,
  statusLabel,
} from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import {
  openEmailComposer,
  openSmsComposer,
  openWhatsAppComposer,
} from '@/features/contacts/contact-delivery';
import { actionMessage, contactLabel } from '@/features/contacts/contact-utils';
import {
  addActionRecipient,
  getActionRecipients,
  getContacts,
} from '@/features/contacts/contact-service';
import { getResearchSessionsForAction, startResearch } from '@/features/research/research-service';

function summaryPoints(value: string) {
  return value
    .split(/\r?\n|[.!?]\s+/)
    .map((point) => point.trim().replace(/[.!?]$/, ''))
    .filter(Boolean)
    .slice(0, 4);
}

export default function ActionDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editing, setEditing] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [editedScheduledAt, setEditedScheduledAt] = useState<string | null>(null);
  const [editedMessageDraft, setEditedMessageDraft] = useState<string | null>(null);
  const [researchTopic, setResearchTopic] = useState('');
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [deliveryError, setDeliveryError] = useState<string | null>(null);
  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const transcriptQuery = useQuery({
    queryKey: ['capture-transcript', actionQuery.data?.voice_capture_id, userId],
    queryFn: () => getCaptureTranscript(actionQuery.data!.voice_capture_id, userId!),
    enabled: Boolean(actionQuery.data && userId),
  });
  const researchQuery = useQuery({
    queryKey: ['research-for-action', id, userId],
    queryFn: () => getResearchSessionsForAction(id, userId!),
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
  const title = editedTitle ?? action?.title ?? '';
  const summary = editedSummary ?? action?.summary ?? '';
  const scheduledAt = editedScheduledAt ?? action?.scheduled_at ?? '';
  const messageDraft = editedMessageDraft ?? action?.message_draft ?? '';
  const selectedContact =
    contactsQuery.data?.find((contact) => contact.id === selectedContactId) ?? null;
  const recipient =
    recipientsQuery.data?.find((contact) => contact.id === selectedContactId) ??
    recipientsQuery.data?.[0] ??
    null;

  function invalidateActionQueries() {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['actions', userId] });
    queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You need to be signed in.');
      const scheduled = normalizedSchedule(scheduledAt);
      if (scheduled === undefined)
        throw new Error('Use a valid date and time, for example 2026-08-23 16:30.');
      return updateAction(id, userId, {
        message_draft: messageDraft.trim() || null,
        scheduled_at: scheduled,
        scheduled_timezone: scheduled
          ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
          : null,
        summary: summary.trim() || null,
        title: title.trim(),
      });
    },
    onSuccess: () => {
      setEditing(false);
      invalidateActionQueries();
    },
  });
  const completeMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return setActionStatus(id, userId, 'completed');
    },
    onSuccess: invalidateActionQueries,
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return deleteAction(id, userId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['actions', userId] });
      router.replace('/inbox');
    },
  });
  const researchMutation = useMutation({
    mutationFn: () => {
      if (!action?.voice_capture_id) {
        throw new Error('Only a saved voice note can be researched.');
      }
      return startResearch({
        actionId: action.id,
        captureId: action.voice_capture_id,
        topic: researchTopic.trim() || action.title,
      });
    },
    onSuccess: ({ researchSessionId }) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['research-for-action', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['research-sessions', userId] });
      }
      router.push({ pathname: '/research/[id]', params: { id: researchSessionId } });
    },
  });
  const recipientMutation = useMutation({
    mutationFn: () => {
      if (!selectedContactId) throw new Error('Choose a contact first.');
      return addActionRecipient(id, selectedContactId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['action-recipients', id, userId] });
    },
  });
  if (actionQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Loading action…</Text>
      </Screen>
    );
  }
  if (actionQuery.error || !action) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Action unavailable</Text>
        <Text style={styles.copy}>
          It may have been removed or you no longer have access to it.
        </Text>
        <AppButton label="Back to inbox" onPress={() => router.replace('/inbox')} />
      </Screen>
    );
  }

  const points = summaryPoints(action.summary ?? '');

  function edit() {
    if (!action) return;
    setValidationError(null);
    setEditedTitle(action.title);
    setEditedSummary(action.summary ?? '');
    setEditedScheduledAt(action.scheduled_at ?? '');
    setEditedMessageDraft(action.message_draft ?? '');
    setEditing(true);
  }

  function saveEdit() {
    if (!title.trim()) {
      setValidationError('Add a short title before saving.');
      return;
    }
    setValidationError(null);
    updateMutation.mutate();
  }

  function prepareDelivery(channel: 'email' | 'sms' | 'whatsapp') {
    if (!recipient || !action) {
      setDeliveryError('Choose a contact before preparing a message.');
      return;
    }

    setDeliveryError(null);
    const message = actionMessage(action);
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

  const mutationError =
    updateMutation.error ??
    completeMutation.error ??
    deleteMutation.error ??
    researchMutation.error ??
    recipientMutation.error;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppButton
          label="‹ Inbox"
          onPress={() => router.replace('/inbox')}
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>{actionTypeLabel(action.action_type).toUpperCase()}</Text>
        <Text style={styles.title}>{editing ? 'Edit action' : action.title}</Text>
        <View style={styles.statusPill}>
          <Text style={styles.statusText}>{statusLabel(action.status)}</Text>
        </View>

        <View style={styles.summaryCard}>
          {editing ? (
            <>
              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                accessibilityLabel="Action title"
                onChangeText={setEditedTitle}
                style={styles.input}
                value={title}
              />
              <Text style={styles.fieldLabel}>Details</Text>
              <TextInput
                accessibilityLabel="Action details"
                multiline
                onChangeText={setEditedSummary}
                style={[styles.input, styles.multilineInput]}
                value={summary}
              />
              <Text style={styles.fieldLabel}>When (optional)</Text>
              <TextInput
                accessibilityHint="Example: 2026-08-23 16:30"
                accessibilityLabel="Schedule"
                onChangeText={setEditedScheduledAt}
                placeholder="2026-08-23 16:30"
                placeholderTextColor={Colors.muted}
                style={styles.input}
                value={scheduledAt}
              />
              {action.action_type === 'message' ? (
                <>
                  <Text style={styles.fieldLabel}>Message draft</Text>
                  <TextInput
                    accessibilityLabel="Message draft"
                    multiline
                    onChangeText={setEditedMessageDraft}
                    style={[styles.input, styles.multilineInput]}
                    value={messageDraft}
                  />
                </>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.summaryLabel}>SUMMARY</Text>
              {points.length ? (
                <View style={styles.points}>
                  {points.map((point, index) => (
                    <View key={`${point}-${index}`} style={styles.pointRow}>
                      <View style={styles.pointDot} />
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.emptySummary}>
                  No extra details were captured for this note.
                </Text>
              )}
              <View style={styles.metaGrid}>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>WHEN</Text>
                  <Text style={styles.metaValue}>{formatActionWhen(action.scheduled_at)}</Text>
                </View>
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>SAVED</Text>
                  <Text style={styles.metaValue}>{formatActionWhen(action.created_at)}</Text>
                </View>
              </View>
              {action.message_draft ? (
                <View style={styles.messageBox}>
                  <Text style={styles.metaLabel}>READY-TO-SEND MESSAGE</Text>
                  <Text style={styles.messageText}>{action.message_draft}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {transcriptQuery.data ? (
          <View style={styles.transcript}>
            <Text style={styles.metaLabel}>ORIGINAL VOICE NOTE</Text>
            <Text style={styles.transcriptText}>{transcriptQuery.data}</Text>
          </View>
        ) : null}

        {!editing ? (
          <View style={styles.researchCard}>
            <Text style={styles.cardTitle}>Research this note</Text>
            <Text style={styles.cardCopy}>
              Choose the exact question now, or leave the note title. Research remains linked here
              after it is complete.
            </Text>
            <TextInput
              accessibilityLabel="Research topic"
              onChangeText={setResearchTopic}
              placeholder={action.title}
              placeholderTextColor={Colors.muted}
              style={styles.input}
              value={researchTopic}
            />
            {action.voice_capture_id ? (
              <AppButton
                label="Research this note"
                loading={researchMutation.isPending}
                onPress={() => researchMutation.mutate()}
              />
            ) : (
              <Text style={styles.cardCopy}>This action was not created from a voice note.</Text>
            )}
            {researchQuery.isPending ? (
              <Text style={styles.cardCopy}>Checking past research…</Text>
            ) : null}
            {researchQuery.data?.map((research) => (
              <AppButton
                key={research.id}
                label={
                  research.status === 'completed'
                    ? `Open research: ${research.topic}`
                    : `Research ${research.status}: ${research.topic}`
                }
                onPress={() =>
                  router.push({ pathname: '/research/[id]', params: { id: research.id } })
                }
                variant="secondary"
              />
            ))}
          </View>
        ) : null}

        {!editing ? (
          <View style={styles.contactCard}>
            <Text style={styles.cardTitle}>Send to a contact</Text>
            <Text style={styles.cardCopy}>
              Choose SMS, WhatsApp or email. The app fills in the message; you confirm sending in
              the selected app.
            </Text>
            {contactsQuery.data?.length ? (
              <ScrollView
                contentContainerStyle={styles.contactChoices}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {contactsQuery.data.map((contact) => (
                  <AppButton
                    key={contact.id}
                    label={contact.name}
                    onPress={() => setSelectedContactId(contact.id)}
                    style={
                      selectedContactId === contact.id
                        ? styles.selectedContact
                        : styles.contactChoice
                    }
                    variant={selectedContactId === contact.id ? 'primary' : 'secondary'}
                  />
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.cardCopy}>Add a contact before preparing a message.</Text>
            )}
            <AppButton
              label="Manage contacts"
              onPress={() => router.push('/contacts')}
              variant="quiet"
            />
            {selectedContact &&
            !recipientsQuery.data?.some((contact) => contact.id === selectedContact.id) ? (
              <AppButton
                label={`Use ${selectedContact.name} for this action`}
                loading={recipientMutation.isPending}
                onPress={() => recipientMutation.mutate()}
                variant="secondary"
              />
            ) : null}
            {recipient ? (
              <>
                <Text style={styles.recipient}>Recipient: {contactLabel(recipient)}</Text>
                {recipient.phone ? (
                  <>
                    <AppButton
                      label="Open WhatsApp"
                      onPress={() => prepareDelivery('whatsapp')}
                      variant="secondary"
                    />
                    <AppButton
                      label="Open SMS composer"
                      onPress={() => prepareDelivery('sms')}
                      variant="secondary"
                    />
                  </>
                ) : null}
                {recipient.email ? (
                  <AppButton
                    label="Open email composer"
                    onPress={() => prepareDelivery('email')}
                    variant="secondary"
                  />
                ) : null}
              </>
            ) : null}
          </View>
        ) : null}

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {mutationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutationError instanceof Error
              ? mutationError.message
              : 'Unable to update this action.'}
          </Text>
        ) : null}
        {deliveryError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {deliveryError}
          </Text>
        ) : null}

        <View style={styles.actions}>
          {editing ? (
            <>
              <AppButton
                label="Save changes"
                loading={updateMutation.isPending}
                onPress={saveEdit}
              />
              <AppButton
                label="Cancel"
                onPress={() => {
                  setEditedTitle(null);
                  setEditedSummary(null);
                  setEditedScheduledAt(null);
                  setEditedMessageDraft(null);
                  setEditing(false);
                }}
                variant="quiet"
              />
            </>
          ) : (
            <>
              {action.status !== 'completed' ? (
                <AppButton
                  label="Mark completed"
                  loading={completeMutation.isPending}
                  onPress={() => completeMutation.mutate()}
                />
              ) : null}
              <AppButton label="Edit action" onPress={edit} variant="secondary" />
              {confirmingDeletion ? (
                <AppButton
                  label="Delete permanently"
                  loading={deleteMutation.isPending}
                  onPress={() => deleteMutation.mutate()}
                  style={styles.deleteButton}
                />
              ) : (
                <AppButton
                  label="Delete action"
                  onPress={() => setConfirmingDeletion(true)}
                  variant="quiet"
                />
              )}
              {confirmingDeletion ? (
                <Text style={styles.deleteHint}>This cannot be undone.</Text>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingVertical: 20 },
  centered: { gap: 16, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 0 },
  eyebrow: { color: Colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 42,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandSoft,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  statusText: { color: Colors.brand, fontSize: 13, fontWeight: '800' },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 14,
    padding: 20,
  },
  summaryLabel: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  points: { gap: 11 },
  pointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  pointDot: { backgroundColor: Colors.accent, borderRadius: 5, height: 9, marginTop: 6, width: 9 },
  pointText: { color: Colors.ink, flex: 1, fontSize: 16, lineHeight: 23 },
  emptySummary: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaTile: {
    backgroundColor: Colors.canvas,
    borderRadius: 14,
    flexGrow: 1,
    gap: 4,
    minWidth: 150,
    padding: 13,
  },
  metaLabel: { color: Colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  metaValue: { color: Colors.ink, fontSize: 16, lineHeight: 23 },
  messageBox: { backgroundColor: Colors.accentSoft, borderRadius: 14, gap: 7, padding: 14 },
  messageText: { color: Colors.ink, fontSize: 16, lineHeight: 23 },
  researchCard: { backgroundColor: Colors.brandSoft, borderRadius: 16, gap: 10, padding: 16 },
  contactCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800' },
  cardCopy: { color: Colors.muted, fontSize: 14, lineHeight: 21 },
  contactChoices: { gap: 8 },
  contactChoice: { minHeight: 42, paddingHorizontal: 13 },
  selectedContact: { minHeight: 42, paddingHorizontal: 13 },
  recipient: { color: Colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  transcript: { backgroundColor: Colors.brandSoft, borderRadius: 16, gap: 7, padding: 16 },
  transcriptText: { color: Colors.ink, fontSize: 15, lineHeight: 23 },
  fieldLabel: { color: Colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
  input: {
    backgroundColor: Colors.canvas,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: Colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  multilineInput: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
  actions: { gap: 10 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  deleteButton: { backgroundColor: Colors.danger },
  deleteHint: { color: Colors.danger, fontSize: 14, textAlign: 'center' },
});
