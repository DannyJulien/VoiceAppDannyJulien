import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { type ActionFilter, getActions } from '@/features/actions/action-service';
import { actionTypeLabel, formatActionWhen, statusLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProjects } from '@/features/projects/project-service';
import { categoryDetails } from '@/features/projects/project-utils';

const filters: { label: string; value: ActionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Tasks', value: 'task' },
  { label: 'Reminders', value: 'reminder' },
  { label: 'Messages', value: 'message' },
];

export default function TimelineScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { session } = useAuth();
  const [filter, setFilter] = useState<ActionFilter>('all');
  const userId = session?.user.id;
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, filter],
    queryFn: () => getActions(userId!, filter),
    enabled: Boolean(userId),
  });
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  // Pending captures belong to the Inbox; the Timeline is what has been decided.
  const actions = (actionsQuery.data ?? []).filter((action) => action.status !== 'pending');

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>EVERYTHING YOU KEPT</Text>
          <Text style={styles.title}>Timeline</Text>
        </View>
        <Text style={styles.copy}>
          Notes, tasks, reminders and messages you approved, or Handle filed for you.
        </Text>
        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {filters.map((item) => (
            <AppButton
              key={item.value}
              label={item.label}
              onPress={() => setFilter(item.value)}
              style={styles.filter}
              variant={filter === item.value ? 'primary' : 'secondary'}
            />
          ))}
        </ScrollView>

        {actionsQuery.isPending ? <Text style={styles.copy}>Loading your timeline…</Text> : null}
        {actionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {actionsQuery.error instanceof Error
                ? actionsQuery.error.message
                : 'Unable to load your timeline.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => actionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {actionsQuery.data && actions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your timeline starts here</Text>
            <Text style={styles.copy}>
              Capture a thought or type a note. Approved captures land here.
            </Text>
            <AppButton label="Capture a thought" onPress={() => router.replace('/home')} />
          </View>
        ) : null}
        <View style={styles.list}>
          {actions.map((action) => (
            <Pressable
              accessibilityLabel={`${actionTypeLabel(action.action_type)}: ${action.title}`}
              accessibilityRole="button"
              key={action.id}
              accessibilityHint="Opens the action details"
              onPress={() => router.push({ pathname: '/action/[id]', params: { id: action.id } })}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={styles.cardTopRow}>
                <Text style={[styles.cardType, { color: categoryDetails(action.category).color }]}>
                  {actionTypeLabel(action.action_type).toUpperCase()}
                </Text>
                <Text style={styles.cardStatus}>{statusLabel(action.status)}</Text>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text numberOfLines={2} style={styles.cardSummary}>
                {action.summary}
              </Text>
              <Text style={styles.cardWhen}>
                {action.project_id
                  ? `${projectsQuery.data?.find((project) => project.id === action.project_id)?.name ?? 'Project'} · `
                  : `${categoryDetails(action.category).label} · `}
                {action.location ? `${action.location} · ` : ''}
                {formatActionWhen(action.created_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
    titleBlock: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
    filters: { gap: 8 },
    filter: { minHeight: 42, paddingHorizontal: 14 },
    list: { gap: 10 },
    actionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 8,
      padding: 18,
    },
    actionCardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
    cardTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
    cardType: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
    cardStatus: { color: colors.muted, fontSize: 13, fontWeight: '700' },
    cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800', lineHeight: 24 },
    cardSummary: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    cardWhen: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    empty: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 12,
      padding: 20,
    },
    emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '800' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    errorCard: { gap: 10 },
  });
