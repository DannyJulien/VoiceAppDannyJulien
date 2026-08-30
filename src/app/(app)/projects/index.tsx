import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getActions } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import { createProject, getProjects } from '@/features/projects/project-service';
import { maxProjectSummaryLength, projectColors } from '@/features/projects/project-utils';

export default function ProjectsScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [color, setColor] = useState(projectColors[0]);
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, 'all'],
    queryFn: () => getActions(userId!, 'all'),
    enabled: Boolean(userId),
  });
  const createMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      if (!name.trim()) throw new Error('Give the project a name first.');
      return createProject(userId, name, color, summary);
    },
    onSuccess: (project) => {
      setName('');
      setSummary('');
      if (userId) queryClient.invalidateQueries({ queryKey: ['projects', userId] });
      router.push({ pathname: '/projects/[id]', params: { id: project.id } });
    },
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>KEEP CONTEXT TOGETHER</Text>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.copy}>
            Each project has its own timeline of notes, research and follow-ups.
          </Text>
        </View>
        <View style={styles.createCard}>
          <Text style={styles.cardTitle}>New project</Text>
          <TextInput
            accessibilityLabel="Project name"
            onChangeText={setName}
            placeholder="e.g. New website"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={name}
          />
          <Text style={styles.fieldLabel}>Project context (optional)</Text>
          <TextInput
            accessibilityHint="A short description helps file related notes in the right project."
            accessibilityLabel="Project summary"
            maxLength={maxProjectSummaryLength}
            multiline
            onChangeText={setSummary}
            placeholder="What is this project about?"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.summaryInput]}
            value={summary}
          />
          <View style={styles.colorRow}>
            {projectColors.map((candidate) => (
              <Pressable
                accessibilityLabel={`Use color ${candidate}`}
                accessibilityRole="button"
                accessibilityState={{ selected: candidate === color }}
                key={candidate}
                onPress={() => setColor(candidate)}
                style={[
                  styles.color,
                  { backgroundColor: candidate },
                  candidate === color && styles.colorSelected,
                ]}
              />
            ))}
          </View>
          {createMutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Unable to create this project.'}
            </Text>
          ) : null}
          <AppButton
            label="Create project"
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          />
        </View>
        <Text style={styles.listTitle}>Your timelines</Text>
        {projectsQuery.isPending ? <Text style={styles.copy}>Loading projects…</Text> : null}
        {projectsQuery.data?.length === 0 ? (
          <Text style={styles.copy}>
            Start with one project or keep notes in your general timeline.
          </Text>
        ) : null}
        <View style={styles.list}>
          {projectsQuery.data?.map((project) => {
            const count =
              actionsQuery.data?.filter((action) => action.project_id === project.id).length ?? 0;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open project ${project.name}`}
                key={project.id}
                onPress={() =>
                  router.push({ pathname: '/projects/[id]', params: { id: project.id } })
                }
                style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]}
              >
                <View style={[styles.projectMark, { backgroundColor: project.color }]} />
                <View style={styles.projectCopy}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.projectMeta}>
                    {count} {count === 1 ? 'item' : 'items'} in timeline
                  </Text>
                  {project.summary ? (
                    <Text numberOfLines={2} style={styles.projectSummary}>
                      {project.summary}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 24 },
    header: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    createCard: { backgroundColor: colors.brandSoft, borderRadius: 22, gap: 12, padding: 17 },
    cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
    fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    summaryInput: { minHeight: 86, paddingTop: 13, textAlignVertical: 'top' },
    colorRow: { flexDirection: 'row', gap: 12 },
    color: { borderColor: 'transparent', borderRadius: 16, borderWidth: 3, height: 32, width: 32 },
    colorSelected: { borderColor: colors.ink },
    listTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
    list: { gap: 10 },
    projectCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 19,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      padding: 16,
    },
    pressed: { opacity: 0.8 },
    projectMark: { borderRadius: 8, height: 16, width: 16 },
    projectCopy: { flex: 1, gap: 3 },
    projectName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    projectMeta: { color: colors.muted, fontSize: 14 },
    projectSummary: { color: colors.muted, fontSize: 13, lineHeight: 19 },
    arrow: { color: colors.muted, fontSize: 28, lineHeight: 28 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
