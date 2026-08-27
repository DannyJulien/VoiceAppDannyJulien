import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { getProjectActions } from '@/features/actions/action-service';
import { actionTypeLabel } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { getProject } from '@/features/projects/project-service';
import { categoryDetails } from '@/features/projects/project-utils';

export default function ProjectTimelineScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const userId = session?.user.id;
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
      <ScrollView contentContainerStyle={styles.content}>
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

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
  center: { gap: 14, justifyContent: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
  hero: { gap: 6 },
  mark: { borderRadius: 6, height: 12, width: 42 },
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
