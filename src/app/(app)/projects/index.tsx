import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';

import { IconButton } from '@/components/icon-button';
import { PlusIcon } from '@/components/icons';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getActions } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import { getProjects } from '@/features/projects/project-service';

export default function ProjectsScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const projectsQuery = useQuery({
    queryKey: ['projects', userId],
    queryFn: () => getProjects(userId!),
    enabled: Boolean(userId),
  });
  const actionsQuery = useQuery({
    queryKey: ['actions', userId, 'all'],
    queryFn: () => getActions(userId!, 'all'),
    enabled: Boolean(userId),
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>KEEP CONTEXT TOGETHER</Text>
          <Text style={styles.title}>Projects</Text>
          <Text style={styles.copy}>
            Each project has its own timeline of notes, research and follow-ups.
          </Text>
        </View>
        <View style={styles.listHeader}>
          <Text style={styles.listTitle}>Your timelines</Text>
          <IconButton
            accessibilityLabel="New project"
            label="New"
            onPress={() => router.push('/projects/new')}
            renderIcon={(color, size) => <PlusIcon color={color} size={size} />}
          />
        </View>
        {projectsQuery.isPending ? <Text style={styles.copy}>Loading projects…</Text> : null}
        {projectsQuery.data?.length === 0 ? (
          <Text style={styles.copy}>
            Start with one project or keep notes in your general timeline.
          </Text>
        ) : null}
        <View style={styles.list}>
          {projectsQuery.data?.map((project) => {
            const count =
              actionsQuery.data?.filter((action) => action.project_id === project.id).length ?? 0;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open project ${project.name}`}
                key={project.id}
                onPress={() =>
                  router.push({ pathname: '/projects/[id]', params: { id: project.id } })
                }
                style={({ pressed }) => [styles.projectCard, pressed && styles.pressed]}
              >
                <View style={[styles.projectMark, { backgroundColor: project.color }]} />
                <View style={styles.projectCopy}>
                  <Text style={styles.projectName}>{project.name}</Text>
                  <Text style={styles.projectMeta}>
                    {count} {count === 1 ? 'item' : 'items'} in timeline
                  </Text>
                </View>
                <Text style={styles.arrow}>›</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 24 },
    header: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 34,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    listHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
    },
    listTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' },
    list: { gap: 10 },
    projectCard: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 19,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 13,
      padding: 16,
    },
    pressed: { opacity: 0.8 },
    projectMark: { borderRadius: 8, height: 16, width: 16 },
    projectCopy: { flex: 1, gap: 3 },
    projectName: { color: colors.ink, fontSize: 17, fontWeight: '900' },
    projectMeta: { color: colors.muted, fontSize: 14 },
    arrow: { color: colors.muted, fontSize: 28, lineHeight: 28 },
  });
