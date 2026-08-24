import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { saveReviewedAction } from '@/features/actions/action-service';
import { understoodActionSchema } from '@/features/actions/action-schema';
import { useActionReview } from '@/features/actions/action-review-provider';
import {
  actionTypeLabel,
  formatActionWhen,
  normalizedSchedule,
} from '@/features/actions/action-utils';
import { useAuth } from '@/features/auth/auth-provider';
import { researchPrompt, shouldOfferResearch } from '@/features/research/research-utils';

function summaryPoints(value: string) {
  return value
    .split(/\r?\n|[.!?]\s+/)
    .map((point) => point.trim().replace(/[.!?]$/, ''))
    .filter(Boolean)
    .slice(0, 4);
}

export default function ReviewScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { clearDraft, draft } = useActionReview();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(() => draft?.action.title ?? '');
  const [summary, setSummary] = useState(() => draft?.action.summary ?? '');
  const [scheduledAt, setScheduledAt] = useState(() => draft?.action.scheduledAt ?? '');
  const [messageDraft, setMessageDraft] = useState(() => draft?.action.messageDraft ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [researchDismissed, setResearchDismissed] = useState(false);

  const saveMutation = useMutation({
    mutationFn: saveReviewedAction,
    onSuccess: () => {
      if (session?.user.id)
        queryClient.invalidateQueries({ queryKey: ['actions', session.user.id] });
      clearDraft();
      router.replace('/inbox');
    },
  });
  if (!draft || !session?.user.id) {
    return (
      <Screen contentStyle={styles.emptyScreen}>
        <Text style={styles.title}>Nothing to review</Text>
        <Text style={styles.copy}>
          Record a thought first, then it will appear here for your approval.
        </Text>
        <AppButton label="Back to home" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  const reviewDraft = draft;
  const userId = session.user.id;
  const action = reviewDraft.action;
  const people = action.people.map((person) => person.name).join(', ');
  const researchSuggested = shouldOfferResearch(action) && !researchDismissed;
  const points = summaryPoints(action.summary);

  function discard() {
    clearDraft();
    router.replace('/home');
  }

  function save() {
    const normalized = normalizedSchedule(scheduledAt);
    if (normalized === undefined) {
      setValidationError('Use a valid date and time, for example 2026-08-23 16:30.');
      return;
    }

    const parsedAction = understoodActionSchema.safeParse({
      ...action,
      title: title.trim(),
      summary: summary.trim(),
      scheduledAt: normalized,
      messageDraft: messageDraft.trim() || null,
    });
    if (!parsedAction.success) {
      setValidationError('Add a short title before you save this action.');
      return;
    }

    setValidationError(null);
    saveMutation.mutate({
      action: parsedAction.data,
      captureId: reviewDraft.captureId,
      timezone: reviewDraft.timezone,
      userId,
    });
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>READY TO REVIEW</Text>
          <Text style={styles.title}>Your thought, clarified.</Text>
          <Text style={styles.copy}>
            Check the summary, make changes if needed, then save it to your Inbox.
          </Text>
        </View>

        {researchSuggested ? (
          <View style={styles.researchCard}>
            <Text style={styles.researchTitle}>Add reliable information?</Text>
            <Text style={styles.researchCopy}>{researchPrompt(action)}</Text>
            <Text style={styles.researchCopy}>
              Save this first. You can refine the topic and start research from the saved note
              whenever you are ready.
            </Text>
            <AppButton
              label="I'll do it later"
              onPress={() => setResearchDismissed(true)}
              variant="quiet"
            />
          </View>
        ) : null}

        {action.requiresClarification ? (
          <View style={styles.clarification}>
            <Text style={styles.clarificationTitle}>One detail to check</Text>
            <Text style={styles.clarificationCopy}>
              {action.clarificationQuestion ?? 'Review this action before saving it.'}
            </Text>
          </View>
        ) : null}

        {editing ? (
          <View style={styles.editorCard}>
            <View style={styles.editorHeader}>
              <Text style={styles.cardHeading}>Make it yours</Text>
              <Text style={styles.editorCopy}>Edit anything before it reaches your Inbox.</Text>
            </View>
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput
              accessibilityLabel="Action title"
              onChangeText={setTitle}
              placeholder="Action title"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              value={title}
            />
            <Text style={styles.fieldLabel}>Summary</Text>
            <TextInput
              accessibilityLabel="Action details"
              multiline
              onChangeText={setSummary}
              placeholder="Add details"
              placeholderTextColor={Colors.muted}
              style={[styles.input, styles.multilineInput]}
              value={summary}
            />
            <Text style={styles.fieldLabel}>When (optional)</Text>
            <TextInput
              accessibilityHint="Example: 2026-08-23 16:30"
              accessibilityLabel="Schedule"
              onChangeText={setScheduledAt}
              placeholder="2026-08-23 16:30"
              placeholderTextColor={Colors.muted}
              style={styles.input}
              value={scheduledAt}
            />
            {action.intent === 'message' ? (
              <>
                <Text style={styles.fieldLabel}>Message draft</Text>
                <TextInput
                  accessibilityLabel="Message draft"
                  multiline
                  onChangeText={setMessageDraft}
                  placeholder="Write the message you want to send later"
                  placeholderTextColor={Colors.muted}
                  style={[styles.input, styles.multilineInput]}
                  value={messageDraft}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.summaryCard}>
            <View style={styles.summaryTopRow}>
              <View>
                <Text style={styles.summaryLabel}>YOUR SUMMARY</Text>
                <Text style={styles.summaryCaption}>Captured from your voice</Text>
              </View>
              <View style={styles.typePill}>
                <Text style={styles.typePillText}>{actionTypeLabel(action.intent)}</Text>
              </View>
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>

            <View style={styles.divider} />
            <Text style={styles.sectionLabel}>THE KEY POINTS</Text>
            {points.length ? (
              <View style={styles.points}>
                {points.map((point, index) => (
                  <View key={`${point}-${index}`} style={styles.pointRow}>
                    <View style={styles.pointDot} />
                    <Text style={styles.pointText}>{point}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptySummary}>Add a few details to create your summary.</Text>
            )}

            <View style={styles.metaGrid}>
              <View style={styles.metaTile}>
                <Text style={styles.metaLabel}>WHEN</Text>
                <Text style={styles.metaValue}>{formatActionWhen(action.scheduledAt)}</Text>
              </View>
              {people ? (
                <View style={styles.metaTile}>
                  <Text style={styles.metaLabel}>PEOPLE</Text>
                  <Text style={styles.metaValue}>{people}</Text>
                </View>
              ) : null}
            </View>
            {action.messageDraft ? (
              <View style={styles.messageBox}>
                <Text style={styles.metaLabel}>READY-TO-SEND MESSAGE</Text>
                <Text style={styles.messageText}>{action.messageDraft}</Text>
              </View>
            ) : null}
          </View>
        )}

        {validationError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {validationError}
          </Text>
        ) : null}
        {saveMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {saveMutation.error instanceof Error
              ? saveMutation.error.message
              : 'Unable to save this action.'}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <AppButton
            label={editing ? 'Save changes' : 'Adjust summary'}
            onPress={editing ? save : () => setEditing(true)}
            variant="secondary"
          />
          <AppButton
            label={action.intent === 'message' ? 'Save message' : 'Save to Inbox'}
            loading={saveMutation.isPending}
            onPress={save}
          />
          <AppButton label="Discard" onPress={discard} variant="quiet" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 18, paddingBottom: 30, paddingTop: 24 },
  emptyScreen: { gap: 16, justifyContent: 'center' },
  header: { gap: 5 },
  eyebrow: { color: Colors.brand, fontSize: 13, fontWeight: '800', letterSpacing: 1.2 },
  title: {
    color: Colors.ink,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.1,
    lineHeight: 40,
  },
  copy: { color: Colors.muted, fontSize: 16, lineHeight: 24 },
  clarification: { backgroundColor: Colors.accentSoft, borderRadius: 18, gap: 5, padding: 16 },
  clarificationTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  clarificationCopy: { color: Colors.muted, fontSize: 15, lineHeight: 21 },
  researchCard: { backgroundColor: Colors.brandSoft, borderRadius: 18, gap: 8, padding: 16 },
  researchTitle: { color: Colors.ink, fontSize: 18, fontWeight: '800' },
  researchCopy: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16,
    padding: 20,
  },
  summaryTopRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  summaryLabel: { color: Colors.brand, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  summaryCaption: { color: Colors.muted, fontSize: 13, marginTop: 3 },
  typePill: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.brandSoft,
    borderRadius: 99,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  typePillText: { color: Colors.brand, fontSize: 13, fontWeight: '800' },
  actionTitle: {
    color: Colors.ink,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.6,
    lineHeight: 33,
  },
  divider: { backgroundColor: Colors.border, height: 1 },
  sectionLabel: { color: Colors.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  points: { gap: 11 },
  pointRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10 },
  pointDot: { backgroundColor: Colors.accent, borderRadius: 5, height: 9, marginTop: 6, width: 9 },
  pointText: { color: Colors.ink, flex: 1, fontSize: 16, lineHeight: 23 },
  emptySummary: { color: Colors.muted, fontSize: 15, lineHeight: 22 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaTile: {
    backgroundColor: Colors.canvas,
    borderRadius: 14,
    flexGrow: 1,
    gap: 4,
    minWidth: 150,
    padding: 13,
  },
  metaLabel: { color: Colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  metaValue: { color: Colors.ink, fontSize: 16, lineHeight: 23 },
  messageBox: { backgroundColor: Colors.accentSoft, borderRadius: 14, gap: 7, padding: 14 },
  messageText: { color: Colors.ink, fontSize: 16, lineHeight: 23 },
  editorCard: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 18,
  },
  editorHeader: { gap: 3, marginBottom: 4 },
  cardHeading: { color: Colors.ink, fontSize: 20, fontWeight: '900' },
  editorCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  fieldLabel: { color: Colors.ink, fontSize: 14, fontWeight: '700', marginTop: 2 },
  input: {
    backgroundColor: Colors.canvas,
    borderColor: Colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: Colors.ink,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
  },
  multilineInput: { minHeight: 110, paddingTop: 13, textAlignVertical: 'top' },
  error: { color: Colors.danger, fontSize: 14, lineHeight: 20 },
  actions: { gap: 10, marginTop: 4 },
});
