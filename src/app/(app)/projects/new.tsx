import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { BackButton } from '@/components/back-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import { createProject } from '@/features/projects/project-service';
import { maxProjectSummaryLength, projectColors } from '@/features/projects/project-utils';

export default function NewProjectScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [color, setColor] = useState(projectColors[0]);
  const createMutation = useMutation({
    mutationFn: () => {
      if (!userId) throw new Error('You need to be signed in.');
      if (!name.trim()) throw new Error('Give the project a name first.');
      return createProject(userId, name, color, summary);
    },
    onSuccess: () => {
      if (userId) queryClient.invalidateQueries({ queryKey: ['projects', userId] });
      // Return to the list this screen was opened from; its query is invalidated, so the
      // new project shows there. A deep link or PWA refresh has no history to go back to.
      if (router.canGoBack()) router.back();
      else router.replace('/projects');
    },
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackHref="/projects"
          fallbackLabel="‹ Projects"
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>NEW PROJECT</Text>
          <Text style={styles.title}>Create a project</Text>
          <Text style={styles.copy}>
            Give it a name and, if it helps, a line of context so related notes are filed here.
          </Text>
        </View>
        <View style={styles.form}>
          <TextInput
            accessibilityLabel="Project name"
            autoFocus
            onChangeText={setName}
            placeholder="e.g. New website"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={name}
          />
          <Text style={styles.fieldLabel}>Project context (optional)</Text>
          <TextInput
            accessibilityHint="A short description helps file related notes in the right project."
            accessibilityLabel="Project summary"
            maxLength={maxProjectSummaryLength}
            multiline
            onChangeText={setSummary}
            placeholder="What is this project about?"
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.summaryInput]}
            value={summary}
          />
          <View style={styles.colorRow}>
            {projectColors.map((candidate) => (
              <Pressable
                accessibilityLabel={`Use color ${candidate}`}
                accessibilityRole="button"
                accessibilityState={{ selected: candidate === color }}
                key={candidate}
                onPress={() => setColor(candidate)}
                style={[
                  styles.color,
                  { backgroundColor: candidate },
                  candidate === color && styles.colorSelected,
                ]}
              />
            ))}
          </View>
          {createMutation.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Unable to create this project.'}
            </Text>
          ) : null}
          <AppButton
            label="Create project"
            loading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 18, paddingBottom: 32, paddingTop: 16 },
    back: { alignSelf: 'flex-start', minHeight: 36, paddingHorizontal: 0 },
    header: { gap: 5 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '900',
      letterSpacing: -1.1,
      lineHeight: 39,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 23 },
    form: { gap: 12 },
    fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '800' },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 14,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    summaryInput: { minHeight: 86, paddingTop: 13, textAlignVertical: 'top' },
    colorRow: { flexDirection: 'row', gap: 12 },
    color: { borderColor: 'transparent', borderRadius: 16, borderWidth: 3, height: 32, width: 32 },
    colorSelected: { borderColor: colors.ink },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
