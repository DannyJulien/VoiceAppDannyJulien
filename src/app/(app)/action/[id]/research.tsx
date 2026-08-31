import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getAction } from '@/features/actions/action-service';
import { useAuth } from '@/features/auth/auth-provider';
import { getResearchSessionsForAction, startResearch } from '@/features/research/research-service';

export default function ResearchActionScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [researchTopic, setResearchTopic] = useState('');
  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const researchQuery = useQuery({
    queryKey: ['research-for-action', id, userId],
    queryFn: () => getResearchSessionsForAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const action = actionQuery.data;

  const researchMutation = useMutation({
    mutationFn: () => {
      if (!action) throw new Error('This note is not available for research.');
      return startResearch({
        actionId: action.id,
        captureId: action.voice_capture_id,
        topic: researchTopic.trim() || action.title,
      });
    },
    onSuccess: ({ researchSessionId }) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['research-for-action', id, userId] });
        queryClient.invalidateQueries({ queryKey: ['research-sessions', userId] });
      }
      router.push({ pathname: '/research/[id]', params: { id: researchSessionId } });
    },
  });

  if (actionQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Loading note…</Text>
      </Screen>
    );
  }
  if (actionQuery.error || !action) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Note unavailable</Text>
        <Text style={styles.copy}>
          It may have been removed or you no longer have access to it.
        </Text>
        <AppButton label="Back to timeline" onPress={() => router.replace('/timeline')} />
      </Screen>
    );
  }

  // Opened from a deep link or a PWA refresh there is no history to go back to.
  function backToNote() {
    if (router.canGoBack()) router.back();
    else router.replace({ pathname: '/action/[id]', params: { id } });
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label="‹ Note"
          onPress={backToNote}
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>RESEARCH</Text>
        <Text style={styles.title}>{action.title}</Text>
        <Text style={styles.copy}>
          Use this saved note as context; you never need to record it again.
        </Text>

        <Text style={styles.fieldLabel}>Research question (optional)</Text>
        <TextInput
          accessibilityHint="Leave empty to research the note title."
          accessibilityLabel="Research topic"
          onChangeText={setResearchTopic}
          placeholder={action.title}
          placeholderTextColor={colors.muted}
          style={styles.input}
          value={researchTopic}
        />
        <AppButton
          label="Research now"
          loading={researchMutation.isPending}
          onPress={() => researchMutation.mutate()}
        />

        {researchMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {researchMutation.error instanceof Error
              ? researchMutation.error.message
              : 'Unable to start this research.'}
          </Text>
        ) : null}

        {researchQuery.isPending ? <Text style={styles.copy}>Checking past research…</Text> : null}
        {researchQuery.data?.map((research) => (
          <Pressable
            accessibilityRole="button"
            key={research.id}
            onPress={() => router.push({ pathname: '/research/[id]', params: { id: research.id } })}
            style={({ pressed }) => [styles.textAction, pressed && styles.pressed]}
          >
            <Text style={styles.textActionLabel}>
              {research.status === 'completed'
                ? `Open research: ${research.topic}`
                : `Research ${research.status}: ${research.topic}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    content: { gap: 16, paddingVertical: 20 },
    centered: { gap: 16, justifyContent: 'center' },
    back: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 0 },
    eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
    title: {
      color: colors.ink,
      fontSize: 32,
      fontWeight: '800',
      letterSpacing: -0.7,
      lineHeight: 40,
    },
    copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
    fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
    input: {
      backgroundColor: colors.canvas,
      borderColor: colors.border,
      borderRadius: 12,
      borderWidth: 1,
      color: colors.ink,
      fontSize: 16,
      minHeight: 52,
      paddingHorizontal: 14,
    },
    textAction: {
      backgroundColor: colors.canvas,
      borderRadius: 12,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 13,
    },
    textActionLabel: { color: colors.brand, fontSize: 14, fontWeight: '800' },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
    pressed: { opacity: 0.8 },
  });
