import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { IconButton } from '@/components/icon-button';
import {
  CalendarIcon,
  MailIcon,
  MessageIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
} from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import {
  approvePendingAction,
  deleteAction,
  getAction,
  getCaptureTranscript,
  setActionStatus,
  suggestedPeopleFrom,
  updateAction,
} from '@/features/actions/action-service';
import { actionIcsFilename, createActionIcsEvent } from '@/features/actions/action-calendar';
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
import { categories } from '@/features/projects/project-utils';
import { getResearchSessionsForAction, startResearch } from '@/features/research/research-service';
import { downloadIcs } from '@/features/share/share';
import type { ActionCategory } from '@/types/database';

function summaryPoints(value: string) {
  return value
    .split(/\r?\n|[.!?]\s+/)
    .map((point) => point.trim().replace(/[.!?]$/, ''))
    .filter(Boolean)
    .slice(0, 4);
}

export default function ActionDetailsScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editing, setEditing] = useState(false);
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [confirmingDismissal, setConfirmingDismissal] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [editedScheduledAt, setEditedScheduledAt] = useState<string | null>(null);
  const [editedMessageDraft, setEditedMessageDraft] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [researchTopic, setResearchTopic] = useState('');
  const [editingPlacement, setEditingPlacement] = useState(false);
  const [reviewCategory, setReviewCategory] = useState<ActionCategory | null>(null);
  const [reviewProjectName, setReviewProjectName] = useState<string | null>(null);
  const [includeSuggestedPeople, setIncludeSuggestedPeople] = useState(true);
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
  const isPendingReview = action?.status === 'pending';
  const selectedReviewCategory = reviewCategory ?? action?.suggested_category ?? 'inbox';
  const selectedReviewProjectName = reviewProjectName ?? action?.suggested_project_name ?? '';
  const canMarkCompleted = !isPendingReview && action?.status !== 'completed';

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
  const approveMutation = useMutation({
    mutationFn: () => {
      if (!userId || !action) throw new Error('This capture is unavailable.');
      return approvePendingAction(action, userId, {
        category: selectedReviewCategory,
        people: includeSuggestedPeople ? suggestedPeople : [],
        projectName: selectedReviewProjectName || null,
      });
    },
    onSuccess: () => {
      invalidateActionQueries();
      if (userId) queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
    },
  });
  const dismissMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return setActionStatus(id, userId, 'cancelled');
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
      router.replace('/timeline');
    },
  });
  const researchMutation = useMutation({
    mutationFn: () => {
      if (!action) throw new Error('This note is not available for research.');
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
        <AppButton label="Back to timeline" onPress={() => router.replace('/timeline')} />
      </Screen>
    );
  }

  const points = summaryPoints(action.summary ?? '');
  const suggestedPeople = suggestedPeopleFrom(action.suggested_people);

  function edit() {
    if (!action) return;
    setValidationError(null);
    setConfirmingDeletion(false);
    setConfirmingDismissal(false);
    setShowMoreActions(false);
    setEditedTitle(action.title);
    setEditedSummary(action.summary ?? '');
    setEditedScheduledAt(action.scheduled_at ?? '');
    setEditedMessageDraft(action.message_draft ?? '');
    setEditing(true);
  }

  function addToOwnCalendar() {
    if (!action) return;
    try {
      setCalendarError(null);
      downloadIcs(actionIcsFilename(action), createActionIcsEvent(action));
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : 'Unable to add this item to your calendar.',
      );
    }
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
    approveMutation.error ??
    dismissMutation.error ??
    deleteMutation.error ??
    researchMutation.error ??
    recipientMutation.error;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label={isPendingReview ? '‹ Inbox' : '‹ Timeline'}
          onPress={() => router.replace(isPendingReview ? '/inbox' : '/timeline')}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>{actionTypeLabel(action.action_type).toUpperCase()}</Text>
            <Text style={styles.title}>{editing ? 'Edit action' : action.title}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{statusLabel(action.status)}</Text>
            </View>
          </View>
          {!editing ? (
            <IconButton
              accessibilityLabel={showMoreActions ? 'Hide note actions' : 'Show note actions'}
              label="More"
              onPress={() => {
                setShowMoreActions((visible) => !visible);
                setConfirmingDeletion(false);
                setConfirmingDismissal(false);
              }}
              renderIcon={(color, size) => <MoreHorizontalIcon color={color} size={size} />}
              style={styles.moreButton}
            />
          ) : null}
        </View>

        {isPendingReview && !editing ? (
          <AppButton
            label="Approve to timeline"
            loading={approveMutation.isPending}
            onPress={() => approveMutation.mutate()}
          />
        ) : null}

        {!editing && canMarkCompleted ? (
          <AppButton
            label="Mark completed"
            loading={completeMutation.isPending}
            onPress={() => completeMutation.mutate()}
          />
        ) : null}

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
                placeholderTextColor={colors.muted}
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
              <Text style={styles.summaryLabel}>NOTE</Text>
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
                {action.scheduled_at ? (
                  <View style={styles.metaTile}>
                    <Text style={styles.metaLabel}>WHEN</Text>
                    <Text style={styles.metaValue}>{formatActionWhen(action.scheduled_at)}</Text>
                  </View>
                ) : null}
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>CAPTURED</Text>
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

        {isPendingReview && !editing ? (
          <>
            <View style={styles.reviewCard}>
              <Text style={styles.cardTitle}>Ready for review</Text>
              <Text style={styles.cardCopy}>
                We will save this note to your timeline with these suggestions. You can fine-tune
                them from More if needed.
              </Text>
              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionLabel}>CATEGORY</Text>
                <Text style={styles.suggestionValue}>
                  {categories.find((item) => item.value === selectedReviewCategory)?.label ??
                    'Inbox'}
                </Text>
              </View>
              {selectedReviewProjectName ? (
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionLabel}>PROJECT</Text>
                  <Text style={styles.suggestionValue}>{selectedReviewProjectName}</Text>
                </View>
              ) : null}
              {suggestedPeople.length ? (
                <View style={styles.suggestionRow}>
                  <Text style={styles.suggestionLabel}>PEOPLE</Text>
                  <Text style={styles.suggestionValue}>
                    {includeSuggestedPeople
                      ? suggestedPeople.map((person) => person.name).join(', ')
                      : 'Will not be added'}
                  </Text>
                </View>
              ) : null}
            </View>
          </>
        ) : null}

        {showMoreActions && !editing ? (
          <View style={styles.overflowCard}>
            {isPendingReview ? (
              <View style={styles.menuSection}>
                <Text style={styles.menuHeading}>Review options</Text>
                <IconButton
                  accessibilityLabel="Edit note before approval"
                  label="Edit note"
                  onPress={edit}
                  renderIcon={(color, size) => <PencilIcon color={color} size={size} />}
                />
                <IconButton
                  accessibilityLabel="Change suggested destination"
                  label="Destination"
                  onPress={() => setEditingPlacement((current) => !current)}
                  renderIcon={(color, size) => <CalendarIcon color={color} size={size} />}
                />
                {suggestedPeople.length ? (
                  <IconButton
                    accessibilityLabel={
                      includeSuggestedPeople
                        ? 'Do not add suggested people'
                        : 'Add suggested people'
                    }
                    label={includeSuggestedPeople ? 'Include people' : 'Skip people'}
                    onPress={() => setIncludeSuggestedPeople((current) => !current)}
                    renderIcon={(color, size) => <UsersIcon color={color} size={size} />}
                  />
                ) : null}
                {editingPlacement ? (
                  <View style={styles.placementEditor}>
                    <Text style={styles.fieldLabel}>Category</Text>
                    <ScrollView
                      contentContainerStyle={styles.choices}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      {categories.map((category) => {
                        const selected = category.value === selectedReviewCategory;
                        return (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            key={category.value}
                            onPress={() => setReviewCategory(category.value)}
                            style={[
                              styles.choice,
                              selected && {
                                backgroundColor: category.color,
                                borderColor: category.color,
                              },
                            ]}
                          >
                            <Text
                              style={[styles.choiceText, selected && styles.choiceTextSelected]}
                            >
                              {category.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                    <Text style={styles.fieldLabel}>Project (optional)</Text>
                    <TextInput
                      accessibilityLabel="Suggested project"
                      onChangeText={setReviewProjectName}
                      placeholder="No project"
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={selectedReviewProjectName}
                    />
                  </View>
                ) : null}
                <View style={styles.dangerZone}>
                  <Text style={styles.dangerLabel}>DANGER ZONE</Text>
                  {confirmingDismissal ? (
                    <>
                      <Text style={styles.deleteHint}>Dismiss this note without saving it?</Text>
                      <View style={styles.confirmRow}>
                        <AppButton
                          label="Keep note"
                          onPress={() => setConfirmingDismissal(false)}
                          style={styles.confirmButton}
                          variant="secondary"
                        />
                        <AppButton
                          label="Dismiss"
                          loading={dismissMutation.isPending}
                          onPress={() => dismissMutation.mutate()}
                          style={styles.deleteConfirmButton}
                        />
                      </View>
                    </>
                  ) : (
                    <IconButton
                      accessibilityLabel="Dismiss this note"
                      label="Dismiss note"
                      onPress={() => setConfirmingDismissal(true)}
                      renderIcon={(color, size) => <TrashIcon color={color} size={size} />}
                      tone="danger"
                    />
                  )}
                </View>
              </View>
            ) : (
              <>
                <View style={styles.menuSection}>
                  <Text style={styles.menuHeading}>Note actions</Text>
                  <View style={styles.compactActions}>
                    <IconButton
                      accessibilityLabel="Edit note"
                      label="Edit"
                      onPress={edit}
                      renderIcon={(color, size) => <PencilIcon color={color} size={size} />}
                    />
                    {action.scheduled_at ? (
                      <IconButton
                        accessibilityHint="Downloads an .ics file you can open in your own calendar app."
                        accessibilityLabel="Add note to my calendar"
                        label="Calendar"
                        onPress={addToOwnCalendar}
                        renderIcon={(color, size) => <CalendarIcon color={color} size={size} />}
                      />
                    ) : null}
                  </View>
                  {calendarError ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {calendarError}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.menuSection}>
                  <Text style={styles.menuHeading}>Research</Text>
                  <Text style={styles.cardCopy}>
                    Use this saved note as context; you never need to record it again.
                  </Text>
                  <View style={styles.compactActions}>
                    <IconButton
                      accessibilityLabel="Research this note now"
                      label="Research now"
                      onPress={() => researchMutation.mutate()}
                      renderIcon={(color, size) => <SearchIcon color={color} size={size} />}
                    />
                    <IconButton
                      accessibilityLabel={
                        researchTopic ? 'Use note title for research' : 'Change research question'
                      }
                      label={researchTopic ? 'Use title' : 'Question'}
                      onPress={() => setResearchTopic(researchTopic ? '' : action.title)}
                      renderIcon={(color, size) => <PencilIcon color={color} size={size} />}
                    />
                  </View>
                  {researchTopic ? (
                    <TextInput
                      accessibilityLabel="Research topic"
                      onChangeText={setResearchTopic}
                      placeholder={action.title}
                      placeholderTextColor={colors.muted}
                      style={styles.input}
                      value={researchTopic}
                    />
                  ) : null}
                  {researchQuery.isPending ? (
                    <Text style={styles.cardCopy}>Checking past research…</Text>
                  ) : null}
                  {researchQuery.data?.map((research) => (
                    <Pressable
                      accessibilityRole="button"
                      key={research.id}
                      onPress={() =>
                        router.push({ pathname: '/research/[id]', params: { id: research.id } })
                      }
                      style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
                    >
                      <Text style={styles.textActionLabel}>
                        {research.status === 'completed'
                          ? `Open research: ${research.topic}`
                          : `Research ${research.status}: ${research.topic}`}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <View style={styles.menuSection}>
                  <View style={styles.menuHeadingRow}>
                    <Text style={styles.menuHeading}>Send to a contact</Text>
                    <IconButton
                      accessibilityLabel="Manage contacts"
                      label="Manage"
                      onPress={() => router.push('/contacts')}
                      renderIcon={(color, size) => <UsersIcon color={color} size={size} />}
                    />
                  </View>
                  <Text style={styles.cardCopy}>
                    Pick a person, then continue in their preferred messaging app.
                  </Text>
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
                              style={[
                                styles.contactChoiceText,
                                selected && styles.selectedContactText,
                              ]}
                            >
                              {contact.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <Text style={styles.cardCopy}>Add a contact before preparing a message.</Text>
                  )}
                  {selectedContact &&
                  !recipientsQuery.data?.some((contact) => contact.id === selectedContact.id) ? (
                    <IconButton
                      accessibilityLabel={`Use ${selectedContact.name} for this action`}
                      label={`Use ${selectedContact.name}`}
                      onPress={() => recipientMutation.mutate()}
                      renderIcon={(color, size) => <UsersIcon color={color} size={size} />}
                    />
                  ) : null}
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
                              renderIcon={(color, size) => (
                                <MessageIcon color={color} size={size} />
                              )}
                            />
                            <IconButton
                              accessibilityLabel={`Open SMS composer for ${recipient.name}`}
                              label="SMS"
                              onPress={() => prepareDelivery('sms')}
                              renderIcon={(color, size) => (
                                <MessageIcon color={color} size={size} />
                              )}
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
                </View>

                <View style={styles.dangerZone}>
                  <Text style={styles.dangerLabel}>DANGER ZONE</Text>
                  {confirmingDeletion ? (
                    <>
                      <Text style={styles.deleteHint}>This cannot be undone.</Text>
                      <View style={styles.confirmRow}>
                        <AppButton
                          label="Keep note"
                          onPress={() => setConfirmingDeletion(false)}
                          style={styles.confirmButton}
                          variant="secondary"
                        />
                        <AppButton
                          label="Delete permanently"
                          loading={deleteMutation.isPending}
                          onPress={() => deleteMutation.mutate()}
                          style={styles.deleteConfirmButton}
                        />
                      </View>
                    </>
                  ) : (
                    <IconButton
                      accessibilityLabel="Delete this note"
                      label="Delete note"
                      onPress={() => setConfirmingDeletion(true)}
                      renderIcon={(color, size) => <TrashIcon color={color} size={size} />}
                      tone="danger"
                    />
                  )}
                </View>
              </>
            )}
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

        {editing ? (
          <View style={styles.actions}>
            <AppButton label="Save changes" loading={updateMutation.isPending} onPress={saveEdit} />
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
          </View>
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
    heroRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    heroCopy: { flex: 1, gap: 8 },
    moreButton: { alignSelf: 'flex-start', marginTop: 4 },
    eyebrow: { color: colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '800',
      letterSpacing: -0.7,
      lineHeight: 42,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
    statusPill: {
      alignSelf: 'flex-start',
      backgroundColor: colors.brandSoft,
      borderRadius: 99,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    statusText: { color: colors.brand, fontSize: 13, fontWeight: '800' },
    summaryCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 24,
      borderWidth: 1,
      gap: 14,
      padding: 20,
    },
    summaryLabel: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    points: { gap: 11 },
    pointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
    pointDot: {
      backgroundColor: colors.accent,
      borderRadius: 5,
      height: 9,
      marginTop: 6,
      width: 9,
    },
    pointText: { color: colors.ink, flex: 1, fontSize: 16, lineHeight: 23 },
    emptySummary: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    metaTile: {
      backgroundColor: colors.canvas,
      borderRadius: 14,
      flexGrow: 1,
      gap: 4,
      minWidth: 150,
      padding: 13,
    },
    metaLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
    metaValue: { color: colors.ink, fontSize: 16, lineHeight: 23 },
    messageBox: { backgroundColor: colors.accentSoft, borderRadius: 14, gap: 7, padding: 14 },
    messageText: { color: colors.ink, fontSize: 16, lineHeight: 23 },
    reviewCard: { backgroundColor: colors.brandSoft, borderRadius: 16, gap: 10, padding: 16 },
    overflowCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      padding: 16,
    },
    menuSection: { gap: 10, paddingVertical: 4 },
    menuHeadingRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    menuHeading: { color: colors.ink, fontSize: 16, fontWeight: '900' },
    compactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
    cardCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
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
    textAction: {
      backgroundColor: colors.canvas,
      borderRadius: 12,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 13,
    },
    textActionLabel: { color: colors.brand, fontSize: 14, fontWeight: '800' },
    suggestionRow: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 13,
      paddingVertical: 11,
    },
    suggestionLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
    suggestionValue: {
      color: colors.ink,
      flexShrink: 1,
      fontSize: 14,
      fontWeight: '800',
      marginLeft: 14,
    },
    placementEditor: { gap: 8 },
    choices: { gap: 8 },
    choice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 99,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 14,
    },
    choiceText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    choiceTextSelected: { color: colors.surface },
    transcript: { backgroundColor: colors.brandSoft, borderRadius: 16, gap: 7, padding: 16 },
    transcriptText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
    fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
    input: {
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    multilineInput: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
    actions: { gap: 10 },
    dangerZone: {
      borderColor: colors.danger,
      borderTopWidth: 1,
      gap: 10,
      marginTop: 16,
      paddingTop: 16,
    },
    dangerLabel: { color: colors.danger, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    confirmRow: { flexDirection: 'row', gap: 8 },
    confirmButton: { flex: 1, minHeight: 46, paddingHorizontal: 10 },
    deleteConfirmButton: {
      backgroundColor: colors.danger,
      flex: 1,
      minHeight: 46,
      paddingHorizontal: 10,
    },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    pressed: { opacity: 0.8 },
    deleteButton: { backgroundColor: colors.danger },
    deleteHint: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  });
