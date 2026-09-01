import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { useAuth } from '@/features/auth/auth-provider';
import {
  messageForUnderstandingError,
  saveTypedCapture,
} from '@/features/captures/understanding-service';

export default function NewNoteScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You need to be signed in.');
      try {
        return await saveTypedCapture({
          text: text.trim(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
          userId,
        });
      } catch (error) {
        throw new Error(await messageForUnderstandingError(error));
      }
    },
    onSuccess: ({ action, decision }) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['actions', userId] });
        queryClient.invalidateQueries({ queryKey: ['projects', userId] });
      }
      if (decision.outcome === 'auto') {
        router.replace({ pathname: '/action/[id]', params: { id: action.id } });
      } else {
        router.replace('/inbox');
      }
    },
  });

  function save() {
    if (!text.trim()) {
      setValidationError('Write what is on your mind first.');
      return;
    }
    setValidationError(null);
    saveMutation.mutate();
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <AppButton
          label="‹ Back"
          onPress={() => router.back()}
          style={styles.back}
          variant="quiet"
        />
        <View style={styles.header}>
          <Text style={styles.eyebrow}>TYPE A THOUGHT</Text>
          <Text style={styles.title}>What’s on your mind?</Text>
          <Text style={styles.copy}>
            Write naturally. Handle will understand the note and file it when it is sure. Anything
            unclear, or involving another person, waits in your Inbox for approval.
          </Text>
        </View>

        <AppTextInput
          accessibilityLabel="Your thought"
          autoFocus
          multiline
          onChangeText={setText}
          placeholder="For example: I need to prepare the proposal with Daniel for next Thursday…"
          style={styles.input}
          textAlignVertical="top"
          value={text}
        />

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {saveMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Unable to organize this note.'}
          </Text>
        ) : null}

        <AppButton
          label="Let Handle organize this"
          loading={saveMutation.isPending}
          onPress={save}
        />
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
    input: {
      backgroundColor: colors.surface,
      borderRadius: 22,
      fontSize: 17,
      lineHeight: 25,
      minHeight: 250,
      padding: 18,
    },
    error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  });
