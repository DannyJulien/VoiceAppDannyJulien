import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { type ActionFilter, getActions } from '@/features/actions/action-service';
import { actionTypeLabel, formatActionWhen, statusLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';

const filters: { label: string; value: ActionFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Notes', value: 'note' },
  { label: 'Tasks', value: 'task' },
  { label: 'Reminders', value: 'reminder' },
  { label: 'Messages', value: 'message' },
];

export default function InboxScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [filter, setFilter] = useState<ActionFilter>('all');
  const userId = session?.user.id;
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, filter],
    queryFn: () => getActions(userId!, filter),
    enabled: Boolean(userId),
  });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>YOUR THOUGHTS, ORGANIZED</Text>
          <Text style={styles.title}>Inbox</Text>
        </View>
        <Text style={styles.copy}>
          Every saved thought lives here until you are ready to act on it.
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
              style={filter === item.value ? styles.activeFilter : styles.filter}
              variant={filter === item.value ? 'primary' : 'secondary'}
            />
          ))}
        </ScrollView>

        {actionsQuery.isPending ? <Text style={styles.copy}>Loading your actions…</Text> : null}
        {actionsQuery.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {actionsQuery.error instanceof Error
              ? actionsQuery.error.message
              : 'Unable to load your actions.'}
          </Text>
        ) : null}
        {actionsQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing handled yet</Text>
            <Text style={styles.copy}>Your confirmed voice actions will appear here.</Text>
            <AppButton label="Capture a thought" onPress={() => router.replace('/home')} />
          </View>
        ) : null}
        <View style={styles.list}>
          {actionsQuery.data?.map((action) => (
            <Pressable
              accessibilityLabel={`${actionTypeLabel(action.action_type)}: ${action.title}`}
              accessibilityRole="button"
              key={action.id}
              accessibilityHint="Opens the action details"
              onPress={() => router.push({ pathname: '/action/[id]', params: { id: action.id } })}
              style={({ pressed }) => [styles.actionCard, pressed && styles.actionCardPressed]}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.cardType}>{actionTypeLabel(action.action_type)}</Text>
                <Text style={styles.cardStatus}>{statusLabel(action.status)}</Text>
              </View>
              <Text style={styles.cardTitle}>{action.title}</Text>
              <Text style={styles.cardWhen}>{formatActionWhen(action.scheduled_at)}</Text>
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
  title: { color: Colors.ink, fontSize: 34, fontWeight: '900', letterSpacing: -1.1, lineHeight: 40 },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  filters: { gap: 8 },
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
});
