import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { AppTextInput } from '@/components/app-text-input';
import { BackButton } from '@/components/back-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { type AppColors, useTheme } from '@/features/theme/theme-provider';
import { createTaskFromResearch, getResearchResult } from '@/features/research/research-service';
import type { ResearchResult } from '@/features/research/research-schema';
import { trustTierLabel } from '@/features/research/research-utils';
import { copyText, shareText } from '@/features/share/share';
import { useAuth } from '@/features/auth/auth-provider';

export default function ResearchResultScreen() {
  const colors = useTheme();
  const styles = createStyles(colors);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const resultQuery = useQuery({
    queryKey: ['research-result', id, userId],
    queryFn: () => getResearchResult(id, userId!),
    enabled: Boolean(id && userId),
  });

  if (resultQuery.isPending) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.copy}>Researching reliable sources…</Text>
      </Screen>
    );
  }
  if (resultQuery.error || !resultQuery.data) {
    return (
      <Screen contentStyle={styles.centered}>
        <Text style={styles.title}>Research unavailable</Text>
        <Text style={styles.copy}>
          {resultQuery.error instanceof Error
            ? resultQuery.error.message
            : 'This research result could not be opened.'}
        </Text>
        <View style={styles.recoveryActions}>
          <AppButton label="Try again" onPress={() => resultQuery.refetch()} />
          <AppButton
            label="Back to research"
            onPress={() => router.replace('/research')}
            variant="secondary"
          />
          <BackButton
            fallbackHref="/timeline"
            fallbackLabel="Go to timeline"
            label="Go back"
            variant="quiet"
          />
        </View>
      </Screen>
    );
  }

  return (
    <ResearchResultContent key={resultQuery.data.id} result={resultQuery.data} userId={userId!} />
  );
}

function ResearchResultContent({ result, userId }: { result: ResearchResult; userId: string }) {
  const colors = useTheme();
  const styles = createStyles(colors);
  const tabBarInset = useTabBarInset();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [shareMessage, setShareMessage] = useState(result.shareMessage);
  const [isEditingShare, setIsEditingShare] = useState(false);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const taskMutation = useMutation({
    mutationFn: () => createTaskFromResearch(result, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actions', userId] });
      router.push('/timeline');
    },
  });
  const sourceById = new Map(result.sources.map((source) => [source.id, source]));

  async function share() {
    setShareStatus(null);
    try {
      const outcome = await shareText(result.topic, shareMessage);
      setShareStatus(
        outcome === 'copied' ? 'Copied. Paste it wherever you like.' : 'Share sheet opened.',
      );
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Unable to share this research.');
    }
  }

  async function copy() {
    setShareStatus(null);
    try {
      await copyText(shareMessage);
      setShareStatus('Copied.');
    } catch (error) {
      setShareStatus(error instanceof Error ? error.message : 'Unable to copy this research.');
    }
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.content, tabBarInset]}
        keyboardShouldPersistTaps="handled"
      >
        <BackButton
          fallbackHref="/research"
          fallbackLabel="‹ Research"
          style={styles.back}
          variant="quiet"
        />
        <Text style={styles.eyebrow}>
          RESEARCHED {new Date(result.researchedAt).toLocaleDateString()}
        </Text>
        <Text style={styles.title}>{result.topic}</Text>

        <View style={styles.answerCard}>
          <Text style={styles.sectionLabel}>ANSWER</Text>
          <Text style={styles.answer}>{result.directAnswer}</Text>
          <Text style={styles.confidence}>Overall confidence: {result.overallConfidence}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>KEY FINDINGS</Text>
          {result.keyFindings.map((finding) => (
            <View key={finding.id} style={styles.findingCard}>
              <Text style={styles.findingClaim}>{finding.claim}</Text>
              {finding.explanation ? <Text style={styles.copy}>{finding.explanation}</Text> : null}
              <View style={styles.citations}>
                {finding.sourceIds.map((sourceId) => {
                  const source = sourceById.get(sourceId);
                  if (!source) return null;
                  return (
                    <Pressable key={source.id} onPress={() => Linking.openURL(source.url)}>
                      <Text style={styles.citation}>Source: {source.title}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TALKING POINTS</Text>
          {result.talkingPoints.map((point) => (
            <Text key={point} style={styles.bullet}>
              • {point}
            </Text>
          ))}
        </View>

        {result.counterpoints.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>COUNTERPOINTS</Text>
            {result.counterpoints.map((point) => (
              <Text key={point} style={styles.bullet}>
                • {point}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SOURCES</Text>
          {result.sources.map((source) => (
            <Pressable
              key={source.id}
              onPress={() => Linking.openURL(source.url)}
              style={styles.sourceCard}
            >
              <Text style={styles.sourceTitle}>{source.title}</Text>
              <Text style={styles.sourceMeta}>
                {[
                  source.publisher,
                  source.publishedAt ? new Date(source.publishedAt).toLocaleDateString() : null,
                  trustTierLabel(source.trustTier),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.shareBox}>
          <Text style={styles.sectionLabel}>SHARE MESSAGE</Text>
          {isEditingShare ? (
            <AppTextInput
              accessibilityLabel="Share message"
              multiline
              onChangeText={setShareMessage}
              style={styles.shareInput}
              value={shareMessage}
            />
          ) : (
            <Text style={styles.copy}>{shareMessage}</Text>
          )}
          <AppButton
            label={isEditingShare ? 'Done editing' : 'Edit message'}
            onPress={() => setIsEditingShare((value) => !value)}
            variant="secondary"
          />
          <AppButton label="Share" onPress={share} />
          <AppButton label="Copy" onPress={copy} variant="quiet" />
          {shareStatus ? <Text style={styles.copy}>{shareStatus}</Text> : null}
        </View>

        {taskMutation.error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            Unable to create the task.
          </Text>
        ) : null}
        <View style={styles.actions}>
          <AppButton
            label="Add to meeting"
            onPress={() =>
              router.push({ pathname: '/research/[id]/meeting', params: { id: result.id } })
            }
          />
          <AppButton
            label="Create task"
            loading={taskMutation.isPending}
            onPress={() => taskMutation.mutate()}
            variant="secondary"
          />
          <AppButton label="Save" onPress={() => router.replace('/research')} variant="quiet" />
        </View>
      </ScrollView>
    </Screen>
  );
}

const createStyles = (colors: AppColors) => StyleSheet.create({
  content: { gap: 16, paddingVertical: 20 },
  centered: { gap: 16, justifyContent: 'center' },
  recoveryActions: { gap: 9 },
  back: { alignSelf: 'flex-start', minHeight: 38, paddingHorizontal: 0 },
  eyebrow: { color: colors.brand, fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
    lineHeight: 40,
  },
  copy: { color: colors.muted, fontSize: 15, lineHeight: 23 },
  answerCard: { backgroundColor: colors.brandSoft, borderRadius: 18, gap: 9, padding: 18 },
  section: { gap: 10 },
  sectionLabel: { color: colors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.9 },
  answer: { color: colors.ink, fontSize: 18, fontWeight: '700', lineHeight: 27 },
  confidence: { color: colors.brand, fontSize: 13, fontWeight: '700' },
  findingCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  findingClaim: { color: colors.ink, fontSize: 17, fontWeight: '800', lineHeight: 24 },
  citations: { gap: 5 },
  citation: {
    color: colors.brand,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textDecorationLine: 'underline',
  },
  bullet: { color: colors.ink, fontSize: 16, lineHeight: 24 },
  sourceCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    gap: 5,
    padding: 14,
  },
  sourceTitle: { color: colors.ink, fontSize: 16, fontWeight: '800', lineHeight: 22 },
  sourceMeta: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  shareBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 16,
  },
  shareInput: { minHeight: 120, padding: 13 },
  actions: { gap: 10 },
  error: { color: colors.danger, fontSize: 14 },
});
