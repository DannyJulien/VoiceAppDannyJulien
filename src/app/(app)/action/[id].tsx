import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { BackButton } from '@/components/back-button';
import {
  CalendarIcon,
  MessageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { MoreMenu } from '@/components/more-menu';
import { type PopoverMenuItem } from '@/components/popover-menu';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import {
  approvePendingAction,
  checklistItemsFrom,
  deleteAction,
  getAction,
  getActionChecklistItems,
  getCaptureTranscript,
  setActionChecklistItemCompleted,
  setActionStatus,
  suggestedPeopleFrom,
  type ChecklistItem,
} from '@/features/actions/action-service';
import { actionIcsFilename, createActionIcsEvent } from '@/features/actions/action-calendar';
import { actionTypeLabel, formatActionWhen, statusLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProjects } from '@/features/projects/project-service';
import { categoryDetails } from '@/features/projects/project-utils';
import { downloadIcs } from '@/features/share/share';

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
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [includeSuggestedPeople, setIncludeSuggestedPeople] = useState(true);
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
  const checklistItemsQuery = useQuery({
    queryKey: ['action-checklist-items', id, userId],
    queryFn: () => getActionChecklistItems(id, userId!),
    enabled: Boolean(id && userId),
  });
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  const action = actionQuery.data;
  const isPendingReview = action?.status === 'pending';
  const appendTargetQuery = useQuery({
    queryKey: ['action', action?.checklist_target_action_id, userId],
    queryFn: () => getAction(action!.checklist_target_action_id!, userId!),
    enabled: Boolean(action?.checklist_target_action_id && userId),
  });
  const canMarkCompleted = !isPendingReview && action?.status !== 'completed';
  const noteProject =
    projectsQuery.data?.find((project) => project.id === action?.project_id) ?? null;
  const reviewCategoryValue = action?.suggested_category ?? action?.category ?? 'inbox';
  const reviewProjectName = action?.suggested_project_name?.trim() || noteProject?.name || '';

  function invalidateActionQueries() {
    if (!userId) return;
    queryClient.invalidateQueries({ queryKey: ['actions', userId] });
    queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
  }

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
        people: includeSuggestedPeople ? suggestedPeople : [],
      });
    },
    onSuccess: (approvedAction) => {
      invalidateActionQueries();
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['contacts', userId] });
        queryClient.invalidateQueries({ queryKey: ['project-actions'] });
      }
      if (approvedAction.id !== action?.id) {
        router.replace({ pathname: '/action/[id]', params: { id: approvedAction.id } });
      }
    },
  });
  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      return deleteAction(id, userId);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['actions', userId] });
      if (router.canGoBack()) router.back();
      else router.replace(isPendingReview ? '/inbox' : '/timeline');
    },
  });
  const checklistMutation = useMutation({
    mutationFn: (item: ChecklistItem) => {
      if (!userId) throw new Error('You need to be signed in.');
      return setActionChecklistItemCompleted(item.id, userId, !item.is_completed);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-checklist-items', id, userId] });
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
        <BackButton fallbackHref="/timeline" fallbackLabel="Back to timeline" label="Go back" />
      </Screen>
    );
  }

  const points = summaryPoints(action.summary ?? '');
  const suggestedPeople = suggestedPeopleFrom(action.suggested_people);
  const checklistItems = checklistItemsQuery.data ?? [];
  const checklistAppendItems = checklistItemsFrom(action.checklist_append_items);
  const isChecklistAppendProposal = Boolean(
    isPendingReview && action.checklist_target_action_id && checklistAppendItems.length,
  );
  const checklistAppendTargetName = appendTargetQuery.data?.title ?? 'your existing checklist';
  const completedChecklistItems = checklistItems.filter((item) => item.is_completed).length;

  function closeMenu() {
    setMenuVisible(false);
    setConfirmingDeletion(false);
  }

  function openMenu() {
    setConfirmingDeletion(false);
    setMenuVisible(true);
  }

  function pushSubScreen(screen: 'checklist' | 'edit' | 'research' | 'send') {
    closeMenu();
    const pathname =
      screen === 'checklist'
        ? ('/action/[id]/checklist' as const)
        : screen === 'edit'
          ? ('/action/[id]/edit' as const)
          : screen === 'research'
            ? ('/action/[id]/research' as const)
            : ('/action/[id]/send' as const);
    // The sub-routes are generated by Expo Router. Keep the small runtime union
    // here while avoiding a stale typed-route cache blocking a valid navigation.
    router.push({ pathname: pathname as never, params: { id } });
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

  const mutationError =
    completeMutation.error ??
    approveMutation.error ??
    deleteMutation.error ??
    checklistMutation.error;

  // One line per action; anything with its own inputs lives on a dedicated sub-screen so
  // this screen never mutates in place.
  const menuItems: PopoverMenuItem[] = isPendingReview
    ? [
        {
          key: 'edit',
          label: 'Edit note',
          onPress: () => pushSubScreen('edit'),
          renderIcon: (color, size) => <PencilIcon color={color} size={size} />,
        },
        ...(!isChecklistAppendProposal
          ? [
              {
                key: 'checklist',
                label: checklistItems.length ? 'Edit checklist' : 'Add checklist',
                onPress: () => pushSubScreen('checklist'),
                renderIcon: (color: string, size: number) => <PlusIcon color={color} size={size} />,
              },
            ]
          : []),
        confirmingDeletion
          ? {
              key: 'dismiss',
              label: 'Dismiss permanently',
              hint: 'The note will be discarded, not saved.',
              loading: deleteMutation.isPending,
              onPress: () => deleteMutation.mutate(undefined, { onSettled: closeMenu }),
              renderIcon: (color, size) => <TrashIcon color={color} size={size} />,
              tone: 'danger',
            }
          : {
              key: 'dismiss',
              label: 'Dismiss note',
              onPress: () => setConfirmingDeletion(true),
              renderIcon: (color, size) => <TrashIcon color={color} size={size} />,
              tone: 'danger',
            },
      ]
    : [
        {
          key: 'edit',
          label: 'Edit note',
          onPress: () => pushSubScreen('edit'),
          renderIcon: (color, size) => <PencilIcon color={color} size={size} />,
        },
        ...(!isChecklistAppendProposal
          ? [
              {
                key: 'checklist',
                label: checklistItems.length ? 'Edit checklist' : 'Add checklist',
                onPress: () => pushSubScreen('checklist'),
                renderIcon: (color: string, size: number) => <PlusIcon color={color} size={size} />,
              },
            ]
          : []),
        ...(action.scheduled_at
          ? [
              {
                key: 'calendar',
                label: 'Add to my calendar',
                onPress: () => {
                  closeMenu();
                  addToOwnCalendar();
                },
                renderIcon: (color: string, size: number) => (
                  <CalendarIcon color={color} size={size} />
                ),
              },
            ]
          : []),
        {
          key: 'research',
          label: 'Research this note',
          onPress: () => pushSubScreen('research'),
          renderIcon: (color, size) => <SearchIcon color={color} size={size} />,
        },
        {
          key: 'contact',
          label: 'Send to a contact',
          onPress: () => pushSubScreen('send'),
          renderIcon: (color, size) => <MessageIcon color={color} size={size} />,
        },
        confirmingDeletion
          ? {
              key: 'delete',
              label: 'Delete permanently',
              hint: 'This cannot be undone.',
              loading: deleteMutation.isPending,
              onPress: () => deleteMutation.mutate(undefined, { onSettled: closeMenu }),
              renderIcon: (color, size) => <TrashIcon color={color} size={size} />,
              tone: 'danger',
            }
          : {
              key: 'delete',
              label: 'Delete note',
              onPress: () => setConfirmingDeletion(true),
              renderIcon: (color, size) => <TrashIcon color={color} size={size} />,
              tone: 'danger',
            },
      ];

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackHref={isPendingReview ? '/inbox' : '/timeline'}
          fallbackLabel={isPendingReview ? '‹ Inbox' : '‹ Timeline'}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.heroRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>
              {checklistItems.length
                ? 'CHECKLIST'
                : actionTypeLabel(action.action_type).toUpperCase()}
            </Text>
            <Text style={styles.title}>{action.title}</Text>
            <View style={styles.statusPill}>
              <Text style={styles.statusText}>{statusLabel(action.status)}</Text>
            </View>
            {!isPendingReview ? (
              <Pressable
                accessibilityHint="Opens the edit screen to change the category or project."
                accessibilityLabel="Note destination"
                accessibilityRole="button"
                onPress={() => pushSubScreen('edit')}
                style={({ pressed }) => [styles.destinationRow, pressed && styles.pressed]}
              >
                <View
                  style={[
                    styles.destinationDot,
                    { backgroundColor: categoryDetails(action.category).color },
                  ]}
                />
                <Text style={styles.destinationText}>
                  {categoryDetails(action.category).label}
                  {noteProject ? ` · ${noteProject.name}` : ' · No project'}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <MoreMenu
            accessibilityLabel="Open note actions"
            items={menuItems}
            onOpen={openMenu}
            onRequestClose={closeMenu}
            style={styles.moreButton}
            visible={menuVisible}
          />
        </View>

        {isPendingReview ? (
          <AppButton
            label={isChecklistAppendProposal ? 'Approve additions' : 'Approve to timeline'}
            loading={approveMutation.isPending}
            onPress={() => approveMutation.mutate()}
          />
        ) : null}

        {canMarkCompleted ? (
          <AppButton
            label="Mark completed"
            loading={completeMutation.isPending}
            onPress={() => completeMutation.mutate()}
          />
        ) : null}

        {isChecklistAppendProposal ? (
          <View style={styles.checklistCard}>
            <View style={styles.checklistHeader}>
              <View>
                <Text style={styles.summaryLabel}>PROPOSED ADDITION</Text>
                <Text style={styles.checklistHint}>
                  These items will be added to {checklistAppendTargetName} after approval.
                </Text>
              </View>
              <Text style={styles.checklistCount}>{checklistAppendItems.length}</Text>
            </View>
            <View style={styles.checklistItems}>
              {checklistAppendItems.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.checklistItem}>
                  <View style={styles.checkmark} />
                  <Text style={styles.checklistItemText}>{item}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {checklistItems.length ? (
          <View style={styles.checklistCard}>
            <View style={styles.checklistHeader}>
              <View>
                <Text style={styles.summaryLabel}>YOUR CHECKLIST</Text>
                <Text style={styles.checklistHint}>Tap an item when it is done.</Text>
              </View>
              <Text style={styles.checklistCount}>
                {completedChecklistItems}/{checklistItems.length}
              </Text>
            </View>
            <View style={styles.checklistItems}>
              {checklistItems.map((item) => (
                <Pressable
                  accessibilityHint="Marks this checklist item as done or not done"
                  accessibilityLabel={item.title}
                  accessibilityRole="checkbox"
                  accessibilityState={{
                    busy:
                      checklistMutation.isPending && checklistMutation.variables?.id === item.id,
                    checked: item.is_completed,
                  }}
                  disabled={checklistMutation.isPending}
                  key={item.id}
                  onPress={() => checklistMutation.mutate(item)}
                  style={({ pressed }) => [
                    styles.checklistItem,
                    item.is_completed && styles.checklistItemCompleted,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.checkmark, item.is_completed && styles.checkmarkCompleted]}>
                    {item.is_completed ? <Text style={styles.checkmarkText}>✓</Text> : null}
                  </View>
                  <Text
                    style={[
                      styles.checklistItemText,
                      item.is_completed && styles.checklistItemTextDone,
                    ]}
                  >
                    {item.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>{checklistItems.length ? 'DETAILS' : 'NOTE'}</Text>
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
            <Text style={styles.emptySummary}>No extra details were captured for this note.</Text>
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
        </View>

        {transcriptQuery.data ? (
          <View style={styles.transcript}>
            <Text style={styles.metaLabel}>ORIGINAL VOICE NOTE</Text>
            <Text style={styles.transcriptText}>{transcriptQuery.data}</Text>
          </View>
        ) : null}

        {isPendingReview ? (
          <View style={styles.reviewCard}>
            <Text style={styles.cardTitle}>Ready for review</Text>
            <Text style={styles.cardCopy}>
              {isChecklistAppendProposal
                ? `Approving adds these items to ${checklistAppendTargetName}. It will not create a second note.`
                : 'Approving saves this note to your timeline with these details. Edit the note if something is off.'}
            </Text>
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionLabel}>CATEGORY</Text>
              <Text style={styles.suggestionValue}>
                {categoryDetails(reviewCategoryValue).label}
              </Text>
            </View>
            {reviewProjectName ? (
              <View style={styles.suggestionRow}>
                <Text style={styles.suggestionLabel}>PROJECT</Text>
                <Text style={styles.suggestionValue}>{reviewProjectName}</Text>
              </View>
            ) : null}
            {suggestedPeople.length ? (
              <Pressable
                accessibilityHint="Toggles whether these people are added when you approve."
                accessibilityRole="button"
                accessibilityState={{ selected: includeSuggestedPeople }}
                onPress={() => setIncludeSuggestedPeople((current) => !current)}
                style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
              >
                <Text style={styles.suggestionLabel}>PEOPLE</Text>
                <View style={styles.suggestionToggle}>
                  <Text style={styles.suggestionValue}>
                    {includeSuggestedPeople
                      ? suggestedPeople.map((person) => person.name).join(', ')
                      : 'Will not be added'}
                  </Text>
                  <Text style={styles.suggestionToggleHint}>
                    {includeSuggestedPeople ? 'Tap to exclude' : 'Tap to include'}
                  </Text>
                </View>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {calendarError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {calendarError}
          </Text>
        ) : null}
        {mutationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {mutationError instanceof Error
              ? mutationError.message
              : 'Unable to update this action.'}
          </Text>
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
    checklistCard: {
      backgroundColor: colors.accentSoft,
      borderColor: colors.focus,
      borderRadius: 24,
      borderWidth: 1,
      gap: 16,
      padding: 18,
    },
    checklistHeader: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    checklistHint: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 4 },
    checklistCount: {
      backgroundColor: colors.surface,
      borderRadius: 99,
      color: colors.brand,
      fontSize: 14,
      fontWeight: '900',
      overflow: 'hidden',
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    checklistItems: { gap: 9 },
    checklistItem: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 15,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 12,
      minHeight: 54,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    checklistItemCompleted: { backgroundColor: colors.canvas },
    checkmark: {
      alignItems: 'center',
      borderColor: colors.muted,
      borderRadius: 11,
      borderWidth: 2,
      height: 22,
      justifyContent: 'center',
      width: 22,
    },
    checkmarkCompleted: { backgroundColor: colors.brand, borderColor: colors.brand },
    checkmarkText: { color: colors.surface, fontSize: 14, fontWeight: '900', lineHeight: 17 },
    checklistItemText: {
      color: colors.ink,
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      lineHeight: 22,
    },
    checklistItemTextDone: { color: colors.muted, textDecorationLine: 'line-through' },
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
    cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
    cardCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
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
    transcript: { backgroundColor: colors.brandSoft, borderRadius: 16, gap: 7, padding: 16 },
    transcriptText: { color: colors.ink, fontSize: 15, lineHeight: 23 },
    destinationRow: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      flexDirection: 'row',
      gap: 7,
      minHeight: 28,
    },
    destinationDot: { borderRadius: 4, height: 8, width: 8 },
    destinationText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
    suggestionToggle: { alignItems: 'flex-end', flexShrink: 1, gap: 2, marginLeft: 14 },
    suggestionToggleHint: { color: colors.brand, fontSize: 11, fontWeight: '800' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    pressed: { opacity: 0.8 },
  });
