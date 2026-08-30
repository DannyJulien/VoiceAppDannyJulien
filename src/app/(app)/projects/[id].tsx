import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getProjectActions } from '@/features/actions/action-service';
import { actionTypeLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProject, updateProjectSummary } from '@/features/projects/project-service';
import { categoryDetails, maxProjectSummaryLength } from '@/features/projects/project-utils';

export default function ProjectTimelineScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const projectQuery = useQuery({
    queryKey: ['project', id, userId],
    queryFn: () => getProject(id, userId!),
    enabled: Boolean(id && userId),
  });
  const actionsQuery = useQuery({
    queryKey: ['project-actions', id, userId],
    queryFn: () => getProjectActions(id, userId!),
    enabled: Boolean(id && userId),
  });
  const project = projectQuery.data;
  const summaryMutation = useMutation({
    mutationFn: () => {
      if (!project || !userId) throw new Error('This project is unavailable.');
      return updateProjectSummary(project.id, userId, summaryDraft);
    },
    onSuccess: () => {
      setEditingSummary(false);
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['project', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
      }
    },
  });
  if (projectQuery.isPending)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.copy}>Loading project…</Text>
      </Screen>
    );
  if (!project)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>Project unavailable</Text>
        <AppButton label="Back to projects" onPress={() => router.replace('/projects' as never)} />
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]}>
        <AppButton
          label="‹ Projects"
          onPress={() => router.replace('/projects' as never)}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.hero}>
          <View style={[styles.mark, { backgroundColor: project.color }]} />
          <Text style={styles.title}>{project.name}</Text>
          <Text style={styles.copy}>
            Everything connected to this project, in the order it happened.
          </Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>PROJECT CONTEXT</Text>
          {editingSummary ? (
            <>
              <TextInput
                accessibilityLabel="Project summary"
                maxLength={maxProjectSummaryLength}
                multiline
                onChangeText={setSummaryDraft}
                placeholder="What should this project keep in mind?"
                placeholderTextColor={colors.muted}
                style={styles.summaryInput}
                value={summaryDraft}
              />
              {summaryMutation.error ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {summaryMutation.error instanceof Error
                    ? summaryMutation.error.message
                    : 'Unable to save the project summary.'}
                </Text>
              ) : null}
              <View style={styles.summaryActions}>
                <AppButton
                  label="Cancel"
                  onPress={() => {
                    setSummaryDraft(project.summary);
                    setEditingSummary(false);
                  }}
                  style={styles.summaryAction}
                  variant="secondary"
                />
                <AppButton
                  label="Save context"
                  loading={summaryMutation.isPending}
                  onPress={() => summaryMutation.mutate()}
                  style={styles.summaryAction}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.summaryCopy}>
                {project.summary ||
                  'Add a short description so related notes can be filed with better context.'}
              </Text>
              <AppButton
                label={project.summary ? 'Edit project context' : 'Add project context'}
                onPress={() => {
                  setSummaryDraft(project.summary);
                  setEditingSummary(true);
                }}
                style={styles.editSummary}
                variant="secondary"
              />
            </>
          )}
        </View>
        <AppButton
          label="Add a note to this project"
          onPress={() => router.push({ pathname: '/note/new', params: { projectId: project.id } })}
        />
        {actionsQuery.isPending ? <Text style={styles.copy}>Loading timeline…</Text> : null}
        {actionsQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>This timeline is empty</Text>
            <Text style={styles.copy}>Add a voice or typed note and it will appear here.</Text>
          </View>
        ) : null}
        <View style={styles.timeline}>
          {actionsQuery.data?.map((action) => {
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

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
    center: { gap: 14, justifyContent: 'center' },
    back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
    hero: { gap: 6 },
    mark: { borderRadius: 6, height: 12, width: 42 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    summaryCard: {
      backgroundColor: colors.brandSoft,
      borderRadius: 18,
      gap: 10,
      padding: 16,
    },
    summaryLabel: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 0.9 },
    summaryCopy: { color: colors.ink, fontSize: 15, lineHeight: 22 },
    summaryInput: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 100,
      paddingHorizontal: 14,
      paddingTop: 13,
      textAlignVertical: 'top',
    },
    summaryActions: { flexDirection: 'row', gap: 8 },
    summaryAction: { flex: 1, minHeight: 46, paddingHorizontal: 10 },
    editSummary: { alignSelf: 'flex-start', minHeight: 42, paddingHorizontal: 14 },
    empty: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 8,
      padding: 20,
    },
    emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
    timeline: { gap: 2 },
    eventRow: { flexDirection: 'row', gap: 12 },
    dot: {
      borderColor: colors.canvas,
      borderRadius: 8,
      borderWidth: 4,
      height: 16,
      marginTop: 18,
      width: 16,
    },
    event: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      flex: 1,
      gap: 5,
      marginBottom: 11,
      padding: 15,
    },
    category: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
    eventTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 23 },
    eventCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    date: { color: colors.muted, fontSize: 12 },
    open: { alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 0 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
