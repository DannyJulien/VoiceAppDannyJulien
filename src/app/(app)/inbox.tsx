import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { getActions } from '@/features/actions/action-service';
import { actionTypeLabel, formatActionWhen } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProfile, updateProfile } from '@/features/auth/profile-service';

export default function InboxScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, 'all'],
    queryFn: () => getActions(userId!, 'all'),
    enabled: Boolean(userId),
  });
  const profileQuery = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId!),
    enabled: Boolean(userId),
  });
  const autoFileMutation = useMutation({
    mutationFn: (enabled: boolean) => updateProfile(userId!, { auto_file_captures: enabled }),
    onSuccess: (profile) => queryClient.setQueryData(['profile', userId], profile),
  });
  // Only captures still waiting for a decision live here; everything else is on the Timeline.
  const pendingActions = (actionsQuery.data ?? []).filter((action) => action.status === 'pending');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton
          label="‹ Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>WAITING FOR YOU</Text>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <Text style={styles.copy}>
          Captures Handle could not file on its own. Approve one and it moves to your Timeline.
        </Text>

        {actionsQuery.isPending ? <Text style={styles.copy}>Loading…</Text> : null}
        {actionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {actionsQuery.error instanceof Error
                ? actionsQuery.error.message
                : 'Unable to load your inbox.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => actionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {actionsQuery.data && pendingActions.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to approve</Text>
            <Text style={styles.copy}>Everything you captured has been filed.</Text>
            <AppButton label="Open timeline" onPress={() => router.replace('/timeline')} />
          </View>
        ) : null}
        <View style={styles.list}>
          {pendingActions.map((action) => (
            <Pressable
              accessibilityLabel={`${actionTypeLabel(action.action_type)}: ${action.title}`}
              accessibilityRole="button"
              key={action.id}
              accessibilityHint="Opens the capture so you can approve it"
              onPress={() => router.push({ pathname: '/action/[id]', params: { id: action.id } })}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardType}>NEEDS YOUR APPROVAL</Text>
                <Text style={styles.cardStatus}>{actionTypeLabel(action.action_type)}</Text>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text numberOfLines={2} style={styles.cardSummary}>
                {action.summary}
              </Text>
              <Text style={styles.cardWhen}>{formatActionWhen(action.created_at)}</Text>
            </Pressable>
          ))}
        </View>

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
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 16 },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  titleBlock: { gap: 5 },
  eyebrow: { color: Colors.danger, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
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
  cardType: { color: Colors.danger, fontSize: 12, fontWeight: '900', letterSpacing: 0.7 },
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
