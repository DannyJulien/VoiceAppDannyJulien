import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { BackButton } from '@/components/back-button';
import { DateTimeField } from '@/components/date-time-field';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import {
  approvePendingActionWithEdits,
  deleteAction,
  getAction,
  suggestedPeopleFrom,
  updateAction,
} from '@/features/actions/action-service';
import {
  isChecklistAppendProposal,
  normalizedActionLocation,
  normalizedSchedule,
} from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { findOrCreateProject, getProjects } from '@/features/projects/project-service';
import { categories, normalizedProjectName } from '@/features/projects/project-utils';
import type { ActionCategory } from '@/types/database';

// Sentinels for the project picker; real choices are project ids (uuids), so no collision.
const NO_PROJECT = 'none';
const CREATE_SUGGESTED = 'create-suggested';

export default function EditActionScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [editedLocation, setEditedLocation] = useState<string | null>(null);
  const [editedScheduledAt, setEditedScheduledAt] = useState<string | null>(null);
  const [editedCategory, setEditedCategory] = useState<ActionCategory | null>(null);
  const [editedProject, setEditedProject] = useState<string | null>(null);
  const [includeSuggestedPeople, setIncludeSuggestedPeople] = useState(true);
  const [confirmingDismiss, setConfirmingDismiss] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  const action = actionQuery.data;
  const projects = projectsQuery.data ?? [];
  // A capture still waiting in the inbox is approved from here in one press. A checklist
  // addition is the exception: approving it appends items and drops the capture, so its
  // edits are saved as before and the note detail keeps the approval.
  const approvesOnSave = Boolean(
    action && action.status === 'pending' && !isChecklistAppendProposal(action),
  );
  const suggestedPeople = suggestedPeopleFrom(action?.suggested_people ?? []);
  const title = editedTitle ?? action?.title ?? '';
  const summary = editedSummary ?? action?.summary ?? '';
  const location = editedLocation ?? action?.location ?? '';
  const scheduledAt = editedScheduledAt ?? action?.scheduled_at ?? '';
  const category = editedCategory ?? action?.suggested_category ?? action?.category ?? 'inbox';
  // The AI's suggested project only matters while it doesn't match an existing project;
  // then it becomes a one-tap "create" chip instead of a silent find-or-create on approval.
  const suggestedName = action?.suggested_project_name?.trim() || null;
  const suggestedMatch = suggestedName
    ? (projects.find(
        (project) => normalizedProjectName(project.name) === normalizedProjectName(suggestedName),
      ) ?? null)
    : null;
  const unmatchedSuggestion = suggestedName && !suggestedMatch ? suggestedName : null;
  const projectChoice = editedProject ?? suggestedMatch?.id ?? action?.project_id ?? NO_PROJECT;

  // Back is a real back: wherever this screen was pushed from. Only a deep link or a PWA
  // refresh has no history; then a waiting capture returns to the inbox, a note to itself.
  const noteHref: Href = { pathname: '/action/[id]', params: { id } };
  const fallbackHref: Href = approvesOnSave ? '/inbox' : noteHref;
  function leave(fallback: Href) {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }

  // Everything the form settles, resolved once so saving and approving cannot drift apart.
  async function editedFields() {
    if (!userId) throw new Error('You need to be signed in.');
    const scheduled = normalizedSchedule(scheduledAt);
    if (scheduled === undefined)
      throw new Error('Use a valid date and time, for example 2026-08-23 16:30.');
    const projectId =
      projectChoice === CREATE_SUGGESTED
        ? ((await findOrCreateProject(userId, unmatchedSuggestion!))?.id ?? null)
        : projectChoice === NO_PROJECT
          ? null
          : projectChoice;
    return {
      category,
      location: normalizedActionLocation(location) || null,
      project_id: projectId,
      scheduled_at: scheduled,
      scheduled_timezone: scheduled
        ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
        : null,
      summary: summary.trim() || null,
      title: title.trim(),
    };
  }

  const submitMutation = useMutation({
    mutationFn: async () => {
      const fields = await editedFields();
      if (approvesOnSave && action) {
        await approvePendingActionWithEdits(
          action,
          userId!,
          fields,
          includeSuggestedPeople ? suggestedPeople : [],
        );
        return 'approved' as const;
      }
      // Saving settles the destination, so the AI suggestions are spent: approval must
      // not re-apply them over what the user chose here.
      await updateAction(id, userId!, {
        ...fields,
        suggested_category: null,
        suggested_project_name: null,
      });
      return 'saved' as const;
    },
    onSuccess: (outcome) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
        queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
        queryClient.invalidateQueries({ queryKey: ['project-actions'] });
        if (outcome === 'approved') {
          queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
        }
      }
      leave(outcome === 'approved' ? '/inbox' : noteHref);
    },
  });
  const dismissMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return deleteAction(id, userId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['actions', userId] });
      leave('/inbox');
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

  function submit() {
    if (!title.trim()) {
      setValidationError('Add a short title before saving.');
      return;
    }
    setValidationError(null);
    submitMutation.mutate();
  }

  const mutationError = submitMutation.error ?? dismissMutation.error;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackHref={fallbackHref}
          fallbackLabel={approvesOnSave ? '‹ Inbox' : '‹ Note'}
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>{approvesOnSave ? 'CHECK AND APPROVE' : 'EDIT NOTE'}</Text>
        <Text style={styles.title}>{action.title}</Text>
        {approvesOnSave ? (
          <Text style={styles.copy}>
            Handle was not sure where this belongs. Correct anything that is off, then approve it to
            your Timeline.
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Title</Text>
          <AppTextInput
            accessibilityLabel="Note title"
            onChangeText={setEditedTitle}
            value={title}
          />
          <Text style={styles.fieldLabel}>Details</Text>
          <AppTextInput
            accessibilityLabel="Note details"
            multiline
            onChangeText={setEditedSummary}
            value={summary}
          />
          <Text style={styles.fieldLabel}>When (optional)</Text>
          <DateTimeField
            accessibilityLabel="Schedule"
            onChange={setEditedScheduledAt}
            value={scheduledAt}
          />
          <Text style={styles.fieldLabel}>Where (optional)</Text>
          <AppTextInput
            accessibilityLabel="Location"
            onChangeText={setEditedLocation}
            placeholder="For example: Brussels Central"
            value={location}
          />
          <Text style={styles.fieldLabel}>Category</Text>
          <ScrollView
            contentContainerStyle={styles.choices}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            {categories.map((item) => {
              const selected = item.value === category;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={item.value}
                  onPress={() => setEditedCategory(item.value)}
                  style={[
                    styles.choice,
                    selected && { backgroundColor: item.color, borderColor: item.color },
                  ]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.fieldLabel}>Project</Text>
          <ScrollView
            contentContainerStyle={styles.choices}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: projectChoice === NO_PROJECT }}
              onPress={() => setEditedProject(NO_PROJECT)}
              style={[styles.choice, projectChoice === NO_PROJECT && styles.selectedNeutral]}
            >
              <Text
                style={[
                  styles.choiceText,
                  projectChoice === NO_PROJECT && styles.choiceTextSelected,
                ]}
              >
                No project
              </Text>
            </Pressable>
            {projects.map((project) => {
              const selected = projectChoice === project.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={project.id}
                  onPress={() => setEditedProject(project.id)}
                  style={[
                    styles.choice,
                    selected && { backgroundColor: project.color, borderColor: project.color },
                  ]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {project.name}
                  </Text>
                </Pressable>
              );
            })}
            {unmatchedSuggestion ? (
              <Pressable
                accessibilityHint="Creates this project and files the note under it."
                accessibilityRole="button"
                accessibilityState={{ selected: projectChoice === CREATE_SUGGESTED }}
                onPress={() => setEditedProject(CREATE_SUGGESTED)}
                style={[
                  styles.choice,
                  styles.createChoice,
                  projectChoice === CREATE_SUGGESTED && styles.selectedNeutral,
                ]}
              >
                <Text
                  style={[
                    styles.createChoiceText,
                    projectChoice === CREATE_SUGGESTED && styles.choiceTextSelected,
                  ]}
                >
                  {`Create “${unmatchedSuggestion}”`}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
          {approvesOnSave && suggestedPeople.length ? (
            <>
              <Text style={styles.fieldLabel}>People</Text>
              <Pressable
                accessibilityHint="Toggles whether these people are added when you approve."
                accessibilityRole="button"
                accessibilityState={{ selected: includeSuggestedPeople }}
                onPress={() => setIncludeSuggestedPeople((current) => !current)}
                style={({ pressed }) => [styles.peopleRow, pressed && styles.pressed]}
              >
                <Text style={styles.peopleNames}>
                  {includeSuggestedPeople
                    ? suggestedPeople.map((person) => person.name).join(', ')
                    : 'Will not be added'}
                </Text>
                <Text style={styles.peopleHint}>
                  {includeSuggestedPeople ? 'Tap to exclude' : 'Tap to include'}
                </Text>
              </Pressable>
            </>
          ) : null}
        </View>

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {mutationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutationError instanceof Error ? mutationError.message : 'Unable to update this note.'}
          </Text>
        ) : null}

        {confirmingDismiss ? (
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Dismiss this capture?</Text>
            <Text style={styles.confirmCopy}>The note will be discarded, not saved.</Text>
            <View style={styles.confirmRow}>
              <AppButton
                label="Dismiss permanently"
                loading={dismissMutation.isPending}
                onPress={() => dismissMutation.mutate()}
                style={styles.confirmButton}
                tone="danger"
              />
              <AppButton
                label="Keep"
                onPress={() => setConfirmingDismiss(false)}
                style={styles.confirmButton}
                variant="secondary"
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <AppButton
              label={approvesOnSave ? 'Approve' : 'Save changes'}
              loading={submitMutation.isPending}
              onPress={submit}
            />
            <View style={styles.secondaryRow}>
              <AppButton
                label="Cancel"
                onPress={() => leave(fallbackHref)}
                style={styles.secondaryButton}
                variant="quiet"
              />
              {approvesOnSave ? (
                <AppButton
                  accessibilityHint="Discards this capture instead of filing it."
                  label="Dismiss note"
                  onPress={() => setConfirmingDismiss(true)}
                  style={styles.secondaryButton}
                  tone="danger"
                  variant="quiet"
                />
              ) : null}
            </View>
          </View>
        )}
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
    choices: { gap: 8, paddingRight: 4 },
    choice: {
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 99,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 40,
      paddingHorizontal: 14,
    },
    choiceText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    choiceTextSelected: { color: colors.surface },
    selectedNeutral: { backgroundColor: colors.brand, borderColor: colors.brand },
    createChoice: { borderColor: colors.brand, borderStyle: 'dashed' },
    createChoiceText: { color: colors.brand, fontSize: 14, fontWeight: '800' },
    peopleRow: {
      alignItems: 'center',
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
      minHeight: 52,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    peopleNames: { color: colors.ink, flexShrink: 1, fontSize: 15, fontWeight: '700' },
    peopleHint: { color: colors.brand, fontSize: 12, fontWeight: '800' },
    pressed: { opacity: 0.8 },
    actions: { gap: 4 },
    secondaryRow: { flexDirection: 'row', gap: 10 },
    secondaryButton: { flex: 1 },
    confirmCard: {
      backgroundColor: colors.dangerSoft,
      borderColor: colors.danger,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 16,
    },
    confirmTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    confirmCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    confirmRow: { flexDirection: 'row', gap: 10 },
    confirmButton: { flex: 1 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
