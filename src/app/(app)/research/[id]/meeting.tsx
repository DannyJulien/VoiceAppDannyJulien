import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { BackButton } from '@/components/back-button';
import { DateTimeField } from '@/components/date-time-field';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { normalizedSchedule } from '@/features/actions/action-utils';
import { createMeetingContext } from '@/features/meetings/meeting-service';
import { createIcsEvent } from '@/features/meetings/meeting-utils';
import { getResearchResult } from '@/features/research/research-service';
import { downloadIcs } from '@/features/share/share';
import { useAuth } from '@/features/auth/auth-provider';

export default function AddToMeetingScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingStart, setMeetingStart] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [savedContext, setSavedContext] = useState<{
    id: string;
    briefing: string;
    meeting_start: string;
    title: string;
  } | null>(null);
  const resultQuery = useQuery({
    queryKey: ['research-result', id, userId],
    queryFn: () => getResearchResult(id, userId!),
    enabled: Boolean(id && userId),
  });
  const meetingMutation = useMutation({ mutationFn: createMeetingContext });

  if (resultQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Loading briefing…</Text>
      </Screen>
    );
  }
  if (resultQuery.error || !resultQuery.data || !userId) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Briefing unavailable</Text>
        <BackButton fallbackHref="/research" fallbackLabel="Back to research" label="Go back" />
      </Screen>
    );
  }

  const result = resultQuery.data;
  const meetingUserId = userId;

  function saveMeeting() {
    const normalizedStart = normalizedSchedule(meetingStart);
    if (!meetingTitle.trim()) {
      setValidationError('Add a meeting title.');
      return;
    }
    if (!normalizedStart) {
      setValidationError('Add a valid meeting time, for example 2026-08-24 14:00.');
      return;
    }
    setValidationError(null);
    meetingMutation.mutate(
      {
        meetingStart: normalizedStart,
        meetingTitle,
        result,
        userId: meetingUserId,
      },
      {
        onSuccess: (context) => {
          setSavedContext({
            id: context.id,
            briefing: context.briefing,
            meeting_start: context.meeting_start,
            title: context.title,
          });
        },
      },
    );
  }

  function exportCalendar() {
    if (!savedContext) return;
    try {
      const contents = createIcsEvent({
        description: savedContext.briefing,
        start: savedContext.meeting_start,
        title: savedContext.title,
        uid: `${savedContext.id}@handled`,
      });
      downloadIcs('handled-meeting-briefing.ics', contents);
    } catch (error) {
      setValidationError(
        error instanceof Error ? error.message : 'Unable to export the calendar event.',
      );
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, tabBarInset]} keyboardShouldPersistTaps="handled">
        <BackButton
          fallbackHref="/research"
          fallbackLabel="‹ Research"
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>MEETING CONTEXT</Text>
        <Text style={styles.title}>Add this briefing to a meeting</Text>
        <Text style={styles.copy}>
          Your research will become preparation notes. Nothing is added to a third-party calendar
          automatically.
        </Text>

        <View style={styles.card}>
          <Text style={styles.topic}>{result.topic}</Text>
          <Text style={styles.fieldLabel}>Meeting title</Text>
          <AppTextInput
            accessibilityLabel="Meeting title"
            onChangeText={setMeetingTitle}
            placeholder="Customer AI Strategy Call"
            value={meetingTitle}
          />
          <Text style={styles.fieldLabel}>Meeting starts</Text>
          <DateTimeField
            accessibilityLabel="Meeting start"
            onChange={setMeetingStart}
            value={meetingStart}
          />
        </View>

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {meetingMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Unable to save the meeting briefing.
          </Text>
        ) : null}
        {savedContext ? (
          <View style={styles.successCard}>
            <Text style={styles.successTitle}>Meeting briefing saved</Text>
            <Text style={styles.copy}>Download an ICS event to choose your own calendar app.</Text>
            <AppButton label="Add to calendar" onPress={exportCalendar} />
            <AppButton
              label="Back to research"
              onPress={() => router.replace('/research')}
              variant="secondary"
            />
          </View>
        ) : (
          <AppButton
            label="Save meeting briefing"
            loading={meetingMutation.isPending}
            onPress={saveMeeting}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
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
  topic: { color: colors.ink, fontSize: 18, fontWeight: '800', marginBottom: 4 },
  fieldLabel: { color: colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  successCard: { backgroundColor: colors.brandSoft, borderRadius: 18, gap: 10, padding: 18 },
  successTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
});
