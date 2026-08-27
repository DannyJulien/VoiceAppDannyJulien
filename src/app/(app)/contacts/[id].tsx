import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { actionTypeLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { contactLabel } from '@/features/contacts/contact-utils';
import { getContact, getContactTimeline } from '@/features/contacts/contact-service';
import { categoryDetails } from '@/features/projects/project-utils';

export default function ContactTimelineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
  const contactQuery = useQuery({
    queryKey: ['contact', id, userId],
    queryFn: () => getContact(id, userId!),
    enabled: Boolean(id && userId),
  });
  const timelineQuery = useQuery({
    queryKey: ['contact-timeline', id, userId],
    queryFn: () => getContactTimeline(id, userId!),
    enabled: Boolean(id && userId),
  });
  const contact = contactQuery.data;
  if (contactQuery.isPending)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.copy}>Loading person…</Text>
      </Screen>
    );
  if (!contact)
    return (
      <Screen contentStyle={styles.center}>
        <Text style={styles.title}>Person unavailable</Text>
        <AppButton label="Back to people" onPress={() => router.replace('/contacts')} />
      </Screen>
    );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <AppButton
          label="‹ People"
          onPress={() => router.replace('/contacts')}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>CONVERSATION TIMELINE</Text>
          <Text style={styles.title}>{contact.name}</Text>
          <Text style={styles.copy}>{contactLabel(contact)}</Text>
        </View>
        <AppButton
          label="Add a note about this person"
          onPress={() => router.push({ pathname: '/note/new', params: { contactId: contact.id } })}
          variant="secondary"
        />
        {timelineQuery.isPending ? <Text style={styles.copy}>Loading conversation…</Text> : null}
        {timelineQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No notes with {contact.name} yet</Text>
            <Text style={styles.copy}>
              When you connect a note to this person, it will appear here in order.
            </Text>
          </View>
        ) : null}
        <View style={styles.timeline}>
          {timelineQuery.data?.map((action) => {
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

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
  center: { gap: 14, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  header: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
  title: { color: Colors.ink, fontSize: 32, fontWeight: '900', letterSpacing: -1, lineHeight: 40 },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 23 },
  empty: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  emptyTitle: { color: Colors.ink, fontSize: 19, fontWeight: '900' },
  timeline: { gap: 2 },
  eventRow: { flexDirection: 'row', gap: 12 },
  dot: {
    borderColor: Colors.canvas,
    borderRadius: 8,
    borderWidth: 4,
    height: 16,
    marginTop: 18,
    width: 16,
  },
  event: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    marginBottom: 11,
    padding: 15,
  },
  category: { fontSize: 12, fontWeight: '900', letterSpacing: 0.6 },
  eventTitle: { color: Colors.ink, fontSize: 17, fontWeight: '900', lineHeight: 23 },
  eventCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  date: { color: Colors.muted, fontSize: 12 },
  open: { alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 0 },
});
