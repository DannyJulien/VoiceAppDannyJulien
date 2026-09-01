import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { BackButton } from '@/components/back-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getAction, updateAction } from '@/features/actions/action-service';
import { normalizedSchedule } from '@/features/actions/action-utils';
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
  const [editedScheduledAt, setEditedScheduledAt] = useState<string | null>(null);
  const [editedCategory, setEditedCategory] = useState<ActionCategory | null>(null);
  const [editedProject, setEditedProject] = useState<string | null>(null);
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
  const title = editedTitle ?? action?.title ?? '';
  const summary = editedSummary ?? action?.summary ?? '';
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
  const projectChoice =
    editedProject ?? suggestedMatch?.id ?? action?.project_id ?? NO_PROJECT;

  // Opened from a deep link or a PWA refresh there is no history to go back to.
  function backToNote() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/action/[id]', params: { id } });
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
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
      // Saving settles the destination, so the AI suggestions are spent: approval must
      // not re-apply them over what the user chose here.
      return updateAction(id, userId, {
        category,
        project_id: projectId,
        scheduled_at: scheduled,
        scheduled_timezone: scheduled
          ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
          : null,
        suggested_category: null,
        suggested_project_name: null,
        summary: summary.trim() || null,
        title: title.trim(),
      });
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
        queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
        queryClient.invalidateQueries({ queryKey: ['project-actions'] });
      }
      backToNote();
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

  function saveEdit() {
    if (!title.trim()) {
      setValidationError('Add a short title before saving.');
      return;
    }
    setValidationError(null);
    updateMutation.mutate();
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
        <Text style={styles.eyebrow}>EDIT NOTE</Text>
        <Text style={styles.title}>{action.title}</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            accessibilityLabel="Note title"
            onChangeText={setEditedTitle}
            style={styles.input}
            value={title}
          />
          <Text style={styles.fieldLabel}>Details</Text>
          <TextInput
            accessibilityLabel="Note details"
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
        </View>

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {updateMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Unable to update this note.'}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <AppButton label="Save changes" loading={updateMutation.isPending} onPress={saveEdit} />
          <AppButton label="Cancel" onPress={backToNote} variant="quiet" />
        </View>
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
    actions: { gap: 10 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
