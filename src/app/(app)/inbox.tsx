import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { type ActionFilter, getActions } from '@/features/actions/action-service';
import { actionTypeLabel, formatActionWhen, statusLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProfile, updateProfile } from '@/features/auth/profile-service';
import { getProjects } from '@/features/projects/project-service';
import { categoryDetails } from '@/features/projects/project-utils';

const filters: { label: string; value: ActionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Tasks', value: 'task' },
  { label: 'Reminders', value: 'reminder' },
  { label: 'Messages', value: 'message' },
];

export default function InboxScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const [filter, setFilter] = useState<ActionFilter>('all');
  const userId = session?.user.id;
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
  });
  const autoFileMutation = useMutation({
    mutationFn: (enabled: boolean) => updateProfile(userId!, { auto_file_captures: enabled }),
    onSuccess: (profile) => queryClient.setQueryData(['profile', userId], profile),
  });
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
  const actions = [...(actionsQuery.data ?? [])].sort((left, right) => {
    if (left.status === 'pending' && right.status !== 'pending') return -1;
    if (left.status !== 'pending' && right.status === 'pending') return 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
  });
  const pendingActions = actions.filter((action) => action.status === 'pending');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>SAVED FOR LATER</Text>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <Text style={styles.copy}>
          Clear captures are filed for you. Anything doubtful, or involving another person, waits
          here until you approve it.
        </Text>
        {profileQuery.data ? (
          <View style={styles.settingRow}>
            <View style={styles.settingCopy}>
              <Text style={styles.settingTitle}>File confident captures automatically</Text>
              <Text style={styles.settingHint}>
                Off means every capture waits here for your approval.
              </Text>
            </View>
            <Switch
              accessibilityLabel="File confident captures automatically"
              disabled={autoFileMutation.isPending}
              onValueChange={(value) => autoFileMutation.mutate(value)}
              value={profileQuery.data.auto_file_captures}
            />
          </View>
        ) : null}
        <View style={styles.topActions}>
          <AppButton label="Write a note" onPress={() => router.push('/note/new')} />
          <AppButton
            label="Calendar"
            onPress={() => router.push('/calendar' as never)}
            variant="secondary"
          />
        </View>

        {pendingActions.length ? (
          <View style={styles.pendingNotice}>
            <Text style={styles.pendingNoticeTitle}>
              {pendingActions.length} {pendingActions.length === 1 ? 'capture is' : 'captures are'}{' '}
              ready for your approval
            </Text>
            <Text style={styles.pendingNoticeCopy}>
              Nothing was sent or filed automatically. Open one when it suits you.
            </Text>
          </View>
        ) : null}

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
              style={filter === item.value ? styles.activeFilter : styles.filter}
              variant={filter === item.value ? 'primary' : 'secondary'}
            />
          ))}
        </ScrollView>

        {actionsQuery.isPending ? <Text style={styles.copy}>Loading your actions…</Text> : null}
        {actionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {actionsQuery.error instanceof Error
                ? actionsQuery.error.message
                : 'Unable to load your actions.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => actionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {actionsQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your timeline starts here</Text>
            <Text style={styles.copy}>
              Capture a thought or type a note. Both stay easy to find.
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
                  {action.status === 'pending'
                    ? 'NEEDS YOUR APPROVAL'
                    : action.auto_filed_at
                      ? `${actionTypeLabel(action.action_type).toUpperCase()} · FILED FOR YOU`
                      : actionTypeLabel(action.action_type).toUpperCase()}
                </Text>
                <Text style={styles.cardStatus}>
                  {action.status === 'pending' ? 'Review' : statusLabel(action.status)}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text numberOfLines={2} style={styles.cardSummary}>
                {action.summary}
              </Text>
              <Text style={styles.cardWhen}>
                {action.project_id
                  ? `${projectsQuery.data?.find((project) => project.id === action.project_id)?.name ?? 'Project'} · `
                  : action.status !== 'pending'
                    ? `${categoryDetails(action.category).label} · `
                    : ''}
                {formatActionWhen(action.created_at)}
              </Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
  titleBlock: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  filters: { gap: 8 },
  topActions: { flexDirection: 'row', gap: 10 },
  settingRow: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  settingCopy: { flex: 1, gap: 2 },
  settingTitle: { color: Colors.ink, fontSize: 15, fontWeight: '800' },
  settingHint: { color: Colors.muted, fontSize: 13, lineHeight: 18 },
  pendingNotice: { backgroundColor: Colors.brandSoft, borderRadius: 18, gap: 4, padding: 16 },
  pendingNoticeTitle: { color: Colors.ink, fontSize: 16, fontWeight: '900' },
  pendingNoticeCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  filter: { minHeight: 42, paddingHorizontal: 14 },
  activeFilter: { minHeight: 42, paddingHorizontal: 14 },
  list: { gap: 10 },
  actionCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 18,
  },
  actionCardPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardType: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
  cardStatus: { color: Colors.muted, fontSize: 13, fontWeight: '700' },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  cardSummary: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  cardWhen: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  empty: {
    alignItems: 'flex-start',
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 12,
    padding: 20,
  },
  emptyTitle: { color: Colors.ink, fontSize: 19, fontWeight: '800' },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  errorCard: { gap: 10 },
});
