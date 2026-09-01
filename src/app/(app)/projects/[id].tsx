import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { CopyIcon, PencilIcon } from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { MoreMenu } from '@/components/more-menu';
import { type PopoverMenuItem } from '@/components/popover-menu';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getProjectActions } from '@/features/actions/action-service';
import { actionTypeLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProject, updateProjectSummary } from '@/features/projects/project-service';
import {
  exportProjectBrief,
  type ProjectBriefMode,
} from '@/features/projects/project-brief-service';
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
  const [menuVisible, setMenuVisible] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [briefFeedback, setBriefFeedback] = useState<string | null>(null);
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
  const briefMutation = useMutation({
    mutationFn: async (mode: ProjectBriefMode) => {
      if (!project || !userId) throw new Error('This project is unavailable.');
      const brief = await exportProjectBrief({ mode, projectId: project.id, userId });
      const copied = await Clipboard.setStringAsync(brief.content);
      if (!copied) throw new Error('Your device could not copy the brief. Please try again.');
      return brief;
    },
    onSuccess: (brief) => {
      const itemCount = brief.includedActionIds.length;
      setBriefFeedback(
        `${brief.mode === 'full' ? 'Full brief' : 'New only update'} copied — ${itemCount} ${itemCount === 1 ? 'entry' : 'entries'} included.`,
      );
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['project-actions', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
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

  const actions = actionsQuery.data ?? [];
  const activeActions = actions.filter((action) => !action.archived_at);
  const archivedActions = actions.filter((action) => action.archived_at);

  function closeMenu() {
    setMenuVisible(false);
  }

  function startEditingSummary() {
    if (!project) return;
    closeMenu();
    setSummaryDraft(project.summary);
    setEditingSummary(true);
  }

  function copyBrief(mode: ProjectBriefMode) {
    setBriefFeedback(null);
    // The row keeps its spinner until the copy settles; the outcome then shows under the
    // header, where it stays readable after the menu has gone.
    briefMutation.mutate(mode, { onSettled: closeMenu });
  }

  // Occasional actions live here so the notes, which are read constantly, start higher.
  const menuItems: PopoverMenuItem[] = [
    {
      key: 'context',
      label: project.summary ? 'Edit project context' : 'Add project context',
      onPress: startEditingSummary,
      renderIcon: (color, size) => <PencilIcon color={color} size={size} />,
    },
    {
      key: 'brief-full',
      label: 'Copy full brief',
      accessibilityHint: 'Copies a complete project brief to your clipboard.',
      loading: briefMutation.isPending && briefMutation.variables === 'full',
      onPress: () => copyBrief('full'),
      renderIcon: (color, size) => <CopyIcon color={color} size={size} />,
    },
    {
      key: 'brief-new',
      label: 'Copy new only',
      accessibilityHint: 'Copies only new knowledge and ideas, plus unfinished next steps.',
      loading: briefMutation.isPending && briefMutation.variables === 'new_only',
      onPress: () => copyBrief('new_only'),
      renderIcon: (color, size) => <CopyIcon color={color} size={size} />,
    },
  ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label="‹ Projects"
          onPress={() => router.replace('/projects' as never)}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.hero}>
          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <View style={[styles.mark, { backgroundColor: project.color }]} />
              <Text style={styles.title}>{project.name}</Text>
            </View>
            <MoreMenu
              accessibilityLabel="Open project actions"
              items={menuItems}
              onOpen={() => setMenuVisible(true)}
              onRequestClose={closeMenu}
              style={styles.moreButton}
              visible={menuVisible}
            />
          </View>
          {editingSummary ? (
            <View style={styles.summaryEditor}>
              <TextInput
                accessibilityLabel="Project summary"
                autoFocus
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
            </View>
          ) : project.summary ? (
            <Text style={styles.summary}>{project.summary}</Text>
          ) : (
            <>
              <Text style={styles.copy}>
                Add a short description so related notes can be filed with better context.
              </Text>
              <AppButton
                label="Add project context"
                onPress={startEditingSummary}
                style={styles.addSummary}
                variant="quiet"
              />
            </>
          )}
          {briefFeedback ? <Text style={styles.success}>{briefFeedback}</Text> : null}
          {briefMutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {briefMutation.error instanceof Error
                ? briefMutation.error.message
                : 'Unable to create the project brief.'}
            </Text>
          ) : null}
        </View>
        {actionsQuery.isPending ? <Text style={styles.copy}>Loading timeline…</Text> : null}
        {activeActions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>This timeline is empty</Text>
            <Text style={styles.copy}>Add a voice or typed note and it will appear here.</Text>
          </View>
        ) : null}
        <View style={styles.timeline}>
          {activeActions.map((action) => {
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
        {archivedActions.length ? (
          <View style={styles.archivedCard}>
            <Text style={styles.archivedTitle}>Shipped to Claude Code</Text>
            <Text style={styles.copy}>
              {archivedActions.length} {archivedActions.length === 1 ? 'entry has' : 'entries have'}{' '}
              already been included in a brief. They remain in the full brief history.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
    center: { gap: 14, justifyContent: 'center' },
    back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
    hero: { gap: 10 },
    heroRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 14,
      justifyContent: 'space-between',
    },
    heroCopy: { flex: 1, gap: 6 },
    moreButton: { alignSelf: 'flex-start', marginTop: 4 },
    mark: { borderRadius: 6, height: 12, width: 42 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    summary: { color: colors.ink, fontSize: 16, lineHeight: 24 },
    summaryEditor: { gap: 10 },
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
    addSummary: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
    success: { color: colors.brand, fontSize: 14, fontWeight: '700', lineHeight: 20 },
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
    archivedCard: {
      backgroundColor: colors.brandSoft,
      borderRadius: 18,
      gap: 7,
      padding: 16,
    },
    archivedTitle: { color: colors.ink, fontSize: 16, fontWeight: '900' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
