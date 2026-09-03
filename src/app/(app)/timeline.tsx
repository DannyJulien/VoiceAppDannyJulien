import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type SavedAction, getActions } from '@/features/actions/action-service';
import { actionTypeLabel, formatActionWhen } from '@/features/actions/action-utils';
import { getTodayActionGroups, groupActionsByCreatedDate } from '@/features/actions/timeline-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { type SavedProject, getProjects } from '@/features/projects/project-service';
import { categoryDetails } from '@/features/projects/project-utils';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';

type TimelineView = 'today' | 'history';
type AttentionKind = 'overdue' | 'today' | 'next' | 'recent' | 'history';
const noActions: SavedAction[] = [];

type ActionCardProps = {
  action: SavedAction;
  emphasis?: AttentionKind;
  project: SavedProject | undefined;
};

function ActionCard({ action, emphasis = 'history', project }: ActionCardProps) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const category = categoryDetails(action.category);
  const emphasisLabel =
    emphasis === 'overdue'
      ? 'OVERDUE'
      : emphasis === 'today'
        ? 'TODAY'
        : emphasis === 'next'
          ? 'NEXT STEP'
          : actionTypeLabel(action.action_type).toUpperCase();
  const context = [project?.name ?? category.label, action.location].filter(Boolean).join(' · ');
  const timeLabel =
    emphasis === 'recent' || emphasis === 'history'
      ? `Added ${formatActionWhen(action.created_at)}`
      : action.scheduled_at
        ? formatActionWhen(action.scheduled_at)
        : 'No time set';

  return (
    <Pressable
      accessibilityHint="Opens this note"
      accessibilityLabel={`${emphasisLabel.toLowerCase()}: ${action.title}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/action/[id]', params: { id: action.id } })}
      style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
    >
      <View style={styles.cardTopRow}>
        <Text
          style={[
            styles.cardKind,
            { color: emphasis === 'overdue' ? colors.danger : category.color },
          ]}
        >
          {emphasisLabel}
        </Text>
        <Text style={styles.cardProject} numberOfLines={1}>
          {context}
        </Text>
      </View>
      <Text style={styles.cardTitle}>{action.title}</Text>
      {action.summary ? (
        <Text numberOfLines={2} style={styles.cardSummary}>
          {action.summary}
        </Text>
      ) : null}
      <Text style={styles.cardWhen}>{timeLabel}</Text>
    </Pressable>
  );
}

function SectionHeading({ title, copy }: { copy: string; title: string }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
    </View>
  );
}

export default function TimelineScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { session } = useAuth();
  const [view, setView] = useState<TimelineView>('today');
  const userId = session?.user.id;
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, 'all'],
    queryFn: () => getActions(userId!, 'all'),
    enabled: Boolean(userId),
  });
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });

  const actions = actionsQuery.data ?? noActions;
  const projectsById = useMemo(
    () => new Map((projectsQuery.data ?? []).map((project) => [project.id, project])),
    [projectsQuery.data],
  );
  const pendingActions = actions.filter((action) => action.status === 'pending');
  const filedActions = actions.filter((action) => action.status !== 'pending');
  const { overdue, today } = useMemo(() => getTodayActionGroups(actions), [actions]);
  const nextSteps = useMemo(
    () =>
      actions
        .filter(
          (action) =>
            action.status === 'approved' &&
            !action.scheduled_at &&
            (action.action_type === 'task' || action.action_type === 'reminder'),
        )
        .slice(0, 3),
    [actions],
  );
  const recent = useMemo(() => filedActions.slice(0, 3), [filedActions]);
  const historyGroups = useMemo(() => groupActionsByCreatedDate(filedActions), [filedActions]);
  const attention = [...overdue, ...today];
  const isLoading = actionsQuery.isPending;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>
            {view === 'today' ? 'YOUR DAY' : 'EVERYTHING YOU KEPT'}
          </Text>
          <Text style={styles.title}>{view === 'today' ? 'Today' : 'History'}</Text>
          <Text style={styles.copy}>
            {view === 'today'
              ? 'The few things worth your attention now. Everything else can wait.'
              : 'Your approved notes, tasks, reminders and messages — grouped by when you added them.'}
          </Text>
        </View>

        <View accessibilityRole="tablist" style={styles.viewSwitch}>
          {(['today', 'history'] as const).map((item) => {
            const selected = view === item;
            return (
              <Pressable
                accessibilityLabel={`Show ${item}`}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                key={item}
                onPress={() => setView(item)}
                style={({ pressed }) => [
                  styles.viewSwitchItem,
                  selected && styles.viewSwitchItemSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.viewSwitchLabel, selected && styles.viewSwitchLabelSelected]}>
                  {item === 'today' ? 'Today' : 'History'}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isLoading ? <Text style={styles.copy}>Loading your day…</Text> : null}
        {actionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {actionsQuery.error instanceof Error
                ? actionsQuery.error.message
                : 'Unable to load your notes.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => actionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}

        {view === 'today' ? (
          <>
            {pendingActions.length ? (
              <Pressable
                accessibilityHint="Opens captures waiting for your approval"
                accessibilityLabel={`${pendingActions.length} captures waiting in Inbox`}
                accessibilityRole="button"
                onPress={() => router.push('/inbox')}
                style={({ pressed }) => [styles.inboxCard, pressed && styles.actionCardPressed]}
              >
                <View style={styles.inboxBadge}>
                  <Text style={styles.inboxBadgeText}>{pendingActions.length}</Text>
                </View>
                <View style={styles.inboxCopy}>
                  <Text style={styles.inboxTitle}>
                    {pendingActions.length === 1
                      ? 'One capture needs a quick review'
                      : 'Captures need a quick review'}
                  </Text>
                  <Text style={styles.inboxText}>Open Inbox to approve or refine them.</Text>
                </View>
                <Text style={styles.inboxArrow}>›</Text>
              </Pressable>
            ) : null}

            <SectionHeading
              copy={
                attention.length
                  ? 'Due today and anything that is running late.'
                  : 'Nothing is scheduled for today.'
              }
              title="Needs attention"
            />
            {attention.length ? (
              <View style={styles.list}>
                {overdue.map((action) => (
                  <ActionCard
                    action={action}
                    emphasis="overdue"
                    key={action.id}
                    project={action.project_id ? projectsById.get(action.project_id) : undefined}
                  />
                ))}
                {today.map((action) => (
                  <ActionCard
                    action={action}
                    emphasis="today"
                    key={action.id}
                    project={action.project_id ? projectsById.get(action.project_id) : undefined}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.calmCard}>
                <Text style={styles.calmTitle}>Your schedule is clear</Text>
                <Text style={styles.calmCopy}>
                  Capture a thought or add a date when something needs a place in your day.
                </Text>
                <AppButton
                  label="Write a note"
                  onPress={() => router.push('/note/new')}
                  variant="secondary"
                />
              </View>
            )}

            {nextSteps.length ? (
              <>
                <SectionHeading
                  copy="Useful next steps without a date yet."
                  title="Pick up when ready"
                />
                <View style={styles.list}>
                  {nextSteps.map((action) => (
                    <ActionCard
                      action={action}
                      emphasis="next"
                      key={action.id}
                      project={action.project_id ? projectsById.get(action.project_id) : undefined}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {recent.length ? (
              <>
                <SectionHeading
                  copy="The latest things Handle organised for you."
                  title="Recently organised"
                />
                <View style={styles.list}>
                  {recent.map((action) => (
                    <ActionCard
                      action={action}
                      emphasis="recent"
                      key={action.id}
                      project={action.project_id ? projectsById.get(action.project_id) : undefined}
                    />
                  ))}
                </View>
                <AppButton
                  label="View full history"
                  onPress={() => setView('history')}
                  variant="quiet"
                />
              </>
            ) : null}

            {!isLoading && !actionsQuery.error && !filedActions.length && !pendingActions.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Your day starts with one thought</Text>
                <Text style={styles.copy}>
                  Speak or type a note. You can review it before it is filed.
                </Text>
                <AppButton label="Capture a thought" onPress={() => router.replace('/home')} />
              </View>
            ) : null}
          </>
        ) : (
          <>
            {!isLoading && !actionsQuery.error && !historyGroups.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No history yet</Text>
                <Text style={styles.copy}>Approve a capture and it will be kept here.</Text>
                <AppButton label="Capture a thought" onPress={() => router.replace('/home')} />
              </View>
            ) : null}
            <View style={styles.historyList}>
              {historyGroups.map((group) => (
                <View key={group.key} style={styles.historyGroup}>
                  <Text style={styles.historyDate}>{group.label}</Text>
                  <View style={styles.list}>
                    {group.actions.map((action) => (
                      <ActionCard
                        action={action}
                        emphasis="history"
                        key={action.id}
                        project={
                          action.project_id ? projectsById.get(action.project_id) : undefined
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
    titleBlock: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 15, lineHeight: 22 },
    viewSwitch: {
      backgroundColor: colors.brandSoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 4,
      padding: 4,
    },
    viewSwitchItem: {
      alignItems: 'center',
      borderRadius: 12,
      flex: 1,
      justifyContent: 'center',
      minHeight: 42,
    },
    viewSwitchItemSelected: {
      backgroundColor: colors.surface,
      boxShadow: `0px 2px 6px ${colors.ink}14`,
    },
    viewSwitchLabel: { color: colors.muted, fontSize: 14, fontWeight: '900' },
    viewSwitchLabelSelected: { color: colors.ink },
    pressed: { opacity: 0.76 },
    inboxCard: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 12,
      padding: 16,
    },
    inboxBadge: {
      alignItems: 'center',
      backgroundColor: colors.accent,
      borderRadius: 999,
      height: 32,
      justifyContent: 'center',
      width: 32,
    },
    inboxBadgeText: { color: colors.onBrand, fontSize: 14, fontWeight: '900' },
    inboxCopy: { flex: 1, gap: 2 },
    inboxTitle: { color: colors.ink, fontSize: 15, fontWeight: '900', lineHeight: 20 },
    inboxText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
    inboxArrow: { color: colors.accent, fontSize: 30, fontWeight: '500', lineHeight: 32 },
    sectionHeading: { gap: 3, marginTop: 4 },
    sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', lineHeight: 27 },
    sectionCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    list: { gap: 10 },
    actionCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 7,
      padding: 16,
    },
    actionCardPressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
    cardTopRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'space-between',
    },
    cardKind: { fontSize: 11, fontWeight: '900', letterSpacing: 0.7 },
    cardProject: { color: colors.muted, flexShrink: 1, fontSize: 12, fontWeight: '800' },
    cardTitle: { color: colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 23 },
    cardSummary: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    cardWhen: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
    calmCard: { backgroundColor: colors.accentSoft, borderRadius: 18, gap: 9, padding: 18 },
    calmTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    calmCopy: { color: colors.muted, fontSize: 14, lineHeight: 20 },
    historyList: { gap: 24 },
    historyGroup: { gap: 9 },
    historyDate: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '900',
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    empty: {
      alignItems: 'flex-start',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 20,
      borderWidth: 1,
      gap: 12,
      padding: 20,
    },
    emptyTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    errorCard: { backgroundColor: colors.dangerSoft, borderRadius: 16, gap: 10, padding: 14 },
  });
