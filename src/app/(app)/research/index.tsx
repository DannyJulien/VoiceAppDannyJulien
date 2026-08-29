import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { type SavedAction, getActions } from '@/features/actions/action-service';
import { getResearchSessions, startResearch } from '@/features/research/research-service';
import { useAuth } from '@/features/auth/auth-provider';

export default function ResearchListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [researchingActionId, setResearchingActionId] = useState<string | null>(null);
  const [lastAttempt, setLastAttempt] = useState<SavedAction | null>(null);
  const sessionsQuery = useQuery({
    queryKey: ['research-sessions', userId],
    queryFn: () => getResearchSessions(userId!),
    enabled: Boolean(userId),
  });
  const notesQuery = useQuery({
    queryKey: ['actions', userId, 'all'],
    queryFn: () => getActions(userId!, 'all'),
    enabled: Boolean(userId),
  });
  const researchMutation = useMutation({
    mutationFn: (action: SavedAction) =>
      startResearch({
        actionId: action.id,
        captureId: action.voice_capture_id,
        topic: action.title,
      }),
    onMutate: (action) => {
      setLastAttempt(action);
      setResearchingActionId(action.id);
    },
    onSuccess: ({ researchSessionId }) => {
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ['research-sessions', userId] });
      }
      router.push({ pathname: '/research/[id]', params: { id: researchSessionId } });
    },
    onSettled: () => setResearchingActionId(null),
  });
  const researchableNotes = notesQuery.data ?? [];

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={styles.eyebrow}>RELIABLE CONTEXT</Text>
          <Text style={styles.title}>Research</Text>
        </View>
        <Text style={styles.copy}>
          Ask about any saved note. Your original note always stays safe, even if research is
          temporarily unavailable.
        </Text>

        <View style={styles.startCard}>
          <Text style={styles.startTitle}>Research a saved note</Text>
          {notesQuery.isPending ? <Text style={styles.copy}>Loading saved notes…</Text> : null}
          {notesQuery.error ? (
            <View accessibilityRole="alert" style={styles.errorCard}>
              <Text style={styles.error}>
                {notesQuery.error instanceof Error
                  ? notesQuery.error.message
                  : 'Unable to load saved notes.'}
              </Text>
              <AppButton
                label="Try again"
                onPress={() => notesQuery.refetch()}
                variant="secondary"
              />
            </View>
          ) : null}
          {!notesQuery.isPending && !notesQuery.error && researchableNotes.length === 0 ? (
            <Text style={styles.copy}>Save a note first, then return here to research it.</Text>
          ) : null}
          {researchableNotes.map((action) => (
            <View key={action.id} style={styles.noteRow}>
              <Text style={styles.noteTitle}>{action.title}</Text>
              <AppButton
                label="Research this note"
                loading={researchMutation.isPending && researchingActionId === action.id}
                onPress={() => researchMutation.mutate(action)}
                variant="secondary"
              />
            </View>
          ))}
          {researchMutation.error && lastAttempt ? (
            <View accessibilityRole="alert" style={styles.failureCard}>
              <Text style={styles.failureTitle}>Research needs another try</Text>
              <Text style={styles.failureCopy}>
                {researchMutation.error instanceof Error
                  ? researchMutation.error.message
                  : 'The research service could not finish this request.'}
              </Text>
              <Text style={styles.failureCopy}>
                Your note is still saved. You can retry now or return to the note whenever you want.
              </Text>
              <AppButton
                label="Retry research"
                onPress={() => researchMutation.mutate(lastAttempt)}
              />
              <AppButton
                label="Open saved note"
                onPress={() =>
                  router.push({ pathname: '/action/[id]', params: { id: lastAttempt.id } })
                }
                variant="secondary"
              />
              <AppButton
                label="Go to inbox"
                onPress={() => router.replace('/timeline')}
                variant="quiet"
              />
            </View>
          ) : null}
        </View>

        {sessionsQuery.isPending ? <Text style={styles.copy}>Loading research…</Text> : null}
        {sessionsQuery.error ? (
          <View accessibilityRole="alert" style={styles.errorCard}>
            <Text style={styles.error}>
              {sessionsQuery.error instanceof Error
                ? sessionsQuery.error.message
                : 'Unable to load research.'}
            </Text>
            <AppButton
              label="Try again"
              onPress={() => sessionsQuery.refetch()}
              variant="secondary"
            />
          </View>
        ) : null}
        {sessionsQuery.data?.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No research yet</Text>
            <Text style={styles.copy}>
              Choose one of the saved notes above to get a sourced answer.
            </Text>
          </View>
        ) : null}
        <View style={styles.list}>
          {sessionsQuery.data?.map((research) => (
            <Pressable
              accessibilityHint="Opens this research result"
              accessibilityLabel={`Research: ${research.topic}`}
              accessibilityRole="button"
              key={research.id}
              onPress={() => {
                if (research.status === 'completed') {
                  router.push({ pathname: '/research/[id]', params: { id: research.id } });
                }
              }}
              style={({ pressed }) => [
                styles.card,
                pressed && research.status === 'completed' && styles.pressed,
              ]}
            >
              <View style={styles.cardTop}>
                <Text style={styles.cardStatus}>{research.status.toUpperCase()}</Text>
                <Text style={styles.cardDate}>
                  {new Date(research.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.cardTitle}>{research.topic}</Text>
              <Text style={styles.cardCopy}>
                {research.status === 'completed'
                  ? (research.executive_summary ?? 'Open research result')
                  : research.status === 'failed'
                    ? 'This attempt could not finish. Your note is safe — retry it from the note above.'
                    : 'Research is still processing.'}
              </Text>
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
  title: {
    color: Colors.ink,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 39,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  list: { gap: 10 },
  startCard: {
    backgroundColor: Colors.brandSoft,
    borderRadius: 22,
    gap: 12,
    padding: 18,
  },
  startTitle: { color: Colors.ink, fontSize: 19, fontWeight: '800' },
  noteRow: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 13,
  },
  noteTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  failureCard: {
    backgroundColor: Colors.dangerSoft,
    borderColor: '#FECDCA',
    borderRadius: 16,
    borderWidth: 1,
    gap: 9,
    padding: 14,
  },
  failureTitle: { color: Colors.ink, fontSize: 16, fontWeight: '900' },
  failureCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 17,
  },
  pressed: { opacity: 0.8 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  cardStatus: { color: Colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  cardDate: { color: Colors.muted, fontSize: 13 },
  cardTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800', lineHeight: 24 },
  cardCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  empty: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 20,
  },
  emptyTitle: { color: Colors.ink, fontSize: 19, fontWeight: '800' },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  errorCard: { gap: 10 },
});
