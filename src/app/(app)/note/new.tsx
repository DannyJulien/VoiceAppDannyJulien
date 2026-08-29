import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { createManualNote, type SavedAction } from '@/features/actions/action-service';
import { normalizedSchedule } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getContacts } from '@/features/contacts/contact-service';
import { getProjects } from '@/features/projects/project-service';
import { categories } from '@/features/projects/project-utils';
import { startResearch } from '@/features/research/research-service';
import type { ActionCategory } from '@/types/database';

export default function NewNoteScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { projectId: initialProjectId, contactId: initialContactId } = useLocalSearchParams<{
    projectId?: string;
    contactId?: string;
  }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [category, setCategory] = useState<ActionCategory>('inbox');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId ?? null);
  const [contactId, setContactId] = useState<string | null>(initialContactId ?? null);
  const [savedAction, setSavedAction] = useState<SavedAction | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  const contactsQuery = useQuery({
    queryKey: ['contacts', userId],
    queryFn: () => getContacts(userId!),
    enabled: Boolean(userId),
  });
  const researchMutation = useMutation({
    mutationFn: (action: SavedAction) =>
      startResearch({ actionId: action.id, captureId: null, topic: action.title }),
    onSuccess: ({ researchSessionId }) => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['research-sessions', userId] });
      router.replace({ pathname: '/research/[id]', params: { id: researchSessionId } });
    },
  });
  const saveMutation = useMutation({
    mutationFn: ({
      shouldResearch,
      scheduled,
    }: {
      shouldResearch: boolean;
      scheduled: string | null;
    }) => {
      if (!userId) throw new Error('You need to be signed in.');
      return createManualNote({
        category,
        contactId,
        projectId,
        scheduledAt: scheduled,
        summary,
        title,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        userId,
      });
    },
    onSuccess: (action, { shouldResearch }) => {
      setSavedAction(action);
      if (userId) queryClient.invalidateQueries({ queryKey: ['actions', userId] });
      if (shouldResearch) {
        researchMutation.mutate(action);
      } else {
        router.replace({ pathname: '/action/[id]', params: { id: action.id } });
      }
    },
  });

  function save(shouldResearch: boolean) {
    if (!title.trim()) {
      setValidationError('Give this note a short title first.');
      return;
    }
    const scheduled = normalizedSchedule(scheduledAt);
    if (scheduled === undefined) {
      setValidationError('Use a valid date and time, for example 2026-08-23 16:30.');
      return;
    }
    setValidationError(null);
    saveMutation.mutate({ shouldResearch, scheduled });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppButton
          label="‹ Back"
          onPress={() => router.back()}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>WRITE IT DOWN</Text>
          <Text style={styles.title}>New note</Text>
          <Text style={styles.copy}>
            Save an idea, a meeting point, or a follow-up — then keep it in the right place.
          </Text>
        </View>

        <View style={styles.editorCard}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            accessibilityLabel="Note title"
            autoFocus
            onChangeText={setTitle}
            placeholder="What is this about?"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={title}
          />
          <Text style={styles.label}>Details</Text>
          <TextInput
            accessibilityLabel="Note details"
            multiline
            onChangeText={setSummary}
            placeholder="Type your note here…"
            placeholderTextColor={Colors.muted}
            style={[styles.input, styles.multilineInput]}
            textAlignVertical="top"
            value={summary}
          />
          <Text style={styles.label}>When (optional)</Text>
          <TextInput
            accessibilityHint="Example: 2026-08-23 16:30"
            accessibilityLabel="Schedule"
            onChangeText={setScheduledAt}
            placeholder="2026-08-23 16:30"
            placeholderTextColor={Colors.muted}
            style={styles.input}
            value={scheduledAt}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Category</Text>
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
                  onPress={() => setCategory(item.value)}
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
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Project</Text>
            <Pressable onPress={() => router.push('/projects' as never)}>
              <Text style={styles.link}>Manage</Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.choices}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: projectId === null }}
              onPress={() => setProjectId(null)}
              style={[styles.choice, projectId === null && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, projectId === null && styles.choiceTextSelected]}>
                No project
              </Text>
            </Pressable>
            {projectsQuery.data?.map((project) => {
              const selected = project.id === projectId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={project.id}
                  onPress={() => setProjectId(project.id)}
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
          </ScrollView>
          {projectsQuery.data?.length === 0 ? (
            <Text style={styles.helper}>Create a project when you want a separate timeline.</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Person (optional)</Text>
          <ScrollView
            contentContainerStyle={styles.choices}
            horizontal
            showsHorizontalScrollIndicator={false}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: contactId === null }}
              onPress={() => setContactId(null)}
              style={[styles.choice, contactId === null && styles.choiceSelected]}
            >
              <Text style={[styles.choiceText, contactId === null && styles.choiceTextSelected]}>
                No person
              </Text>
            </Pressable>
            {contactsQuery.data?.map((contact) => {
              const selected = contact.id === contactId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={contact.id}
                  onPress={() => setContactId(contact.id)}
                  style={[styles.choice, selected && styles.choiceSelected]}
                >
                  <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>
                    {contact.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {saveMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Unable to save this note.'}
          </Text>
        ) : null}
        {researchMutation.error && savedAction ? (
          <View accessibilityRole="alert" style={styles.researchError}>
            <Text style={styles.error}>
              Your note was saved. Research could not start:{' '}
              {researchMutation.error instanceof Error
                ? researchMutation.error.message
                : 'Please try again.'}
            </Text>
            <AppButton
              label="Open saved note"
              onPress={() =>
                router.replace({ pathname: '/action/[id]', params: { id: savedAction.id } })
              }
              variant="secondary"
            />
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            disabled={Boolean(savedAction) || researchMutation.isPending}
            label="Save note"
            loading={saveMutation.isPending}
            onPress={() => save(false)}
          />
          <AppButton
            disabled={Boolean(savedAction) || researchMutation.isPending}
            label="Save & research now"
            loading={researchMutation.isPending}
            onPress={() => save(true)}
            variant="secondary"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  header: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  editorCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 9,
    padding: 17,
  },
  label: { color: Colors.ink, fontSize: 14, fontWeight: '800', marginTop: 2 },
  input: {
    backgroundColor: Colors.canvas,
    borderColor: Colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: Colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  multilineInput: { minHeight: 150, paddingTop: 14 },
  section: { gap: 8 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: { color: Colors.ink, fontSize: 16, fontWeight: '900' },
  link: { color: Colors.brand, fontSize: 14, fontWeight: '800' },
  choices: { gap: 8 },
  choice: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  choiceSelected: { backgroundColor: Colors.brand, borderColor: Colors.brand },
  choiceText: { color: Colors.ink, fontSize: 14, fontWeight: '800' },
  choiceTextSelected: { color: Colors.surface },
  helper: { color: Colors.muted, fontSize: 13, lineHeight: 19 },
  actions: { gap: 10 },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  researchError: { backgroundColor: Colors.dangerSoft, borderRadius: 16, gap: 10, padding: 14 },
});
