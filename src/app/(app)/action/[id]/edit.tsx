import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { getAction, updateAction } from '@/features/actions/action-service';
import { normalizedSchedule } from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';

export default function EditActionScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedSummary, setEditedSummary] = useState<string | null>(null);
  const [editedScheduledAt, setEditedScheduledAt] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const actionQuery = useQuery({
    queryKey: ['action', id, userId],
    queryFn: () => getAction(id, userId!),
    enabled: Boolean(id && userId),
  });
  const action = actionQuery.data;
  const title = editedTitle ?? action?.title ?? '';
  const summary = editedSummary ?? action?.summary ?? '';
  const scheduledAt = editedScheduledAt ?? action?.scheduled_at ?? '';

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You need to be signed in.');
      const scheduled = normalizedSchedule(scheduledAt);
      if (scheduled === undefined)
        throw new Error('Use a valid date and time, for example 2026-08-23 16:30.');
      return updateAction(id, userId, {
        scheduled_at: scheduled,
        scheduled_timezone: scheduled
          ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC')
          : null,
        summary: summary.trim() || null,
        title: title.trim(),
      });
    },
    onSuccess: () => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
        queryClient.invalidateQueries({ queryKey: ['action', id, userId] });
      }
      router.back();
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

  function saveEdit() {
    if (!title.trim()) {
      setValidationError('Add a short title before saving.');
      return;
    }
    setValidationError(null);
    updateMutation.mutate();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label="‹ Note"
          onPress={() => router.back()}
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>EDIT NOTE</Text>
        <Text style={styles.title}>{action.title}</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Title</Text>
          <TextInput
            accessibilityLabel="Note title"
            onChangeText={setEditedTitle}
            style={styles.input}
            value={title}
          />
          <Text style={styles.fieldLabel}>Details</Text>
          <TextInput
            accessibilityLabel="Note details"
            multiline
            onChangeText={setEditedSummary}
            style={[styles.input, styles.multilineInput]}
            value={summary}
          />
          <Text style={styles.fieldLabel}>When (optional)</Text>
          <TextInput
            accessibilityHint="Example: 2026-08-23 16:30"
            accessibilityLabel="Schedule"
            onChangeText={setEditedScheduledAt}
            placeholder="2026-08-23 16:30"
            placeholderTextColor={colors.muted}
            style={styles.input}
            value={scheduledAt}
          />
        </View>

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {updateMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {updateMutation.error instanceof Error
              ? updateMutation.error.message
              : 'Unable to update this note.'}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <AppButton label="Save changes" loading={updateMutation.isPending} onPress={saveEdit} />
          <AppButton label="Cancel" onPress={() => router.back()} variant="quiet" />
        </View>
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
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 18,
      borderWidth: 1,
      gap: 10,
      padding: 18,
    },
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
    multilineInput: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
    actions: { gap: 10 },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
