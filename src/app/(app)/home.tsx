import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/components/app-button';
import { useTabBarInset } from '@/components/mobile-navigation';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { filingReasonLabel } from '@/features/actions/filing-gate';
import { signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { formatDuration } from '@/features/captures/capture-utils';
import { useVoiceCapture } from '@/features/captures/use-voice-capture';

export default function HomeScreen() {
  const tabBarInset = useTabBarInset();
  const { session } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceCapture = useVoiceCapture(session?.user.id);
  const {
    canRetryProcessing,
    clearInboxAction,
    discardPendingUploads,
    durationMillis,
    error: captureError,
    filingDecision,
    isRecording,
    inboxAction,
    pendingCount,
    phase,
    retryProcessing,
    retryUploads,
    startRecording,
    stopRecording,
  } = voiceCapture;
  const isBusy = phase === 'uploading' || phase === 'understanding';

  useEffect(() => {
    if (!inboxAction || !session?.user.id) return;
    void queryClient.invalidateQueries({ queryKey: ['actions', session.user.id] });
  }, [inboxAction, queryClient, session?.user.id]);

  async function onSignOut() {
    setError(null);
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <Screen contentStyle={styles.content}>
      <ScrollView contentContainerStyle={[styles.scrollContent, tabBarInset]} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <View style={styles.brandRow}>
            <View style={styles.mark} />
            <Text style={styles.brand}>Handled</Text>
          </View>
          <Pressable
            accessibilityLabel="Sign out"
            accessibilityRole="button"
            disabled={isSigningOut}
            onPress={onSignOut}
            style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          >
            <Text style={styles.signOutLabel}>{isSigningOut ? 'Signing out…' : 'Sign out'}</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CAPTURE</Text>
          <Text style={styles.title}>Say it. Save it.</Text>
          <Text style={styles.copy}>
            Capture a thought by voice or write one down. Sort it after, without losing the flow.
          </Text>
          <View style={styles.captureArea}>
            <Pressable
              accessibilityHint={
                isRecording ? 'Stops and securely uploads your recording' : 'Starts a new recording'
              }
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording'}
              accessibilityRole="button"
              accessibilityState={{ busy: isBusy }}
              disabled={isBusy}
              onPress={isRecording ? stopRecording : startRecording}
              style={({ pressed }) => [
                styles.microphone,
                isRecording && styles.microphoneRecording,
                (pressed || isBusy) && styles.microphonePressed,
              ]}
            >
              <View style={styles.microphoneIcon}>
                <View style={isRecording ? styles.stopIcon : styles.micStem} />
                {!isRecording ? <View style={styles.micBase} /> : null}
              </View>
            </Pressable>
            <Text style={styles.captureStatus}>
              {isRecording
                ? `Listening · ${formatDuration(durationMillis)}`
                : phase === 'understanding'
                  ? 'Making sense of it…'
                  : isBusy
                    ? 'Saving your recording…'
                    : inboxAction
                      ? 'Saved to your Inbox — review it whenever you are ready.'
                      : 'Tap to start recording'}
            </Text>
            {isRecording ? (
              <View style={styles.liveRow}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>
                  Voice is being captured. You can review the transcript after you stop.
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.quickActions}>
          <AppButton
            label="Write a note"
            onPress={() => router.push('/note/new')}
            variant="secondary"
          />
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>Keep the context together</Text>
          <Text style={styles.tipCopy}>
            Assign every note to a project or category, research it when useful, and link a person.
          </Text>
        </View>

        {inboxAction ? (
          <View style={styles.resumeCard}>
            <View style={styles.resumeCopyBlock}>
              <Text style={styles.resumeTitle}>
                {filingDecision?.outcome === 'auto' ? 'Filed for you' : 'Saved to your Inbox'}
              </Text>
              <Text numberOfLines={2} style={styles.resumeCopy}>
                {inboxAction.title}
              </Text>
              {filingDecision && filingDecision.outcome !== 'auto' ? (
                <Text numberOfLines={2} style={styles.resumeCopy}>
                  Waiting for you because {filingDecision.reasons.map(filingReasonLabel).join(', ')}
                  .
                </Text>
              ) : null}
            </View>
            <AppButton
              label={filingDecision?.outcome === 'auto' ? 'Open' : 'Open Inbox'}
              onPress={() => {
                clearInboxAction();
                if (filingDecision?.outcome === 'auto') {
                  router.push({ pathname: '/action/[id]', params: { id: inboxAction.id } });
                } else {
                  router.push('/inbox');
                }
              }}
              style={styles.resumeButton}
              variant="secondary"
            />
          </View>
        ) : null}

        {pendingCount > 0 ? (
          <View style={styles.retryCard}>
            <Text style={styles.retryTitle}>{pendingCount} recording awaiting upload</Text>
            <Text style={styles.retryCopy}>
              Nothing has been lost. Connect to the internet and retry.
            </Text>
            <AppButton label="Retry upload" onPress={retryUploads} variant="secondary" />
            <AppButton
              label="Discard this local recording"
              onPress={discardPendingUploads}
              variant="quiet"
            />
          </View>
        ) : null}
        {canRetryProcessing ? (
          <View style={styles.retryCard}>
            <Text style={styles.retryTitle}>Your recording is safe</Text>
            <Text style={styles.retryCopy}>
              The upload completed. Retry only the voice-understanding step.
            </Text>
            <AppButton label="Retry understanding" onPress={retryProcessing} variant="secondary" />
          </View>
        ) : null}
        {captureError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {captureError}
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12 },
  scrollContent: { gap: 16, paddingBottom: 30, paddingTop: 8 },
  // Right gutter keeps Sign out clear of the floating Inbox button.
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingRight: 100,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  mark: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.brand },
  brand: { color: Colors.ink, fontSize: 18, fontWeight: '800' },
  signOut: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 },
  signOutPressed: { backgroundColor: Colors.brandSoft },
  signOutLabel: { color: Colors.brand, fontSize: 13, fontWeight: '800' },
  hero: {
    backgroundColor: Colors.brand,
    borderRadius: 26,
    gap: 12,
    overflow: 'hidden',
    padding: 22,
  },
  eyebrow: { color: '#C7D2FE', fontSize: 12, fontWeight: '900', letterSpacing: 1.25 },
  title: {
    color: Colors.surface,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  copy: { color: '#E0E7FF', fontSize: 16, lineHeight: 24, maxWidth: 370 },
  captureArea: { alignItems: 'center', gap: 12, marginTop: 6 },
  microphone: {
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderColor: '#FFFFFF',
    borderRadius: 66,
    borderWidth: 4,
    height: 132,
    justifyContent: 'center',
    boxShadow: '0px 8px 16px rgba(17, 24, 39, 0.25)',
    width: 132,
  },
  microphoneRecording: { backgroundColor: Colors.danger },
  microphonePressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  microphoneIcon: { alignItems: 'center', height: 55, justifyContent: 'center', width: 55 },
  micStem: { backgroundColor: Colors.surface, borderRadius: 12, height: 33, width: 22 },
  micBase: {
    borderBottomWidth: 4,
    borderColor: Colors.surface,
    borderLeftWidth: 4,
    borderRightWidth: 4,
    borderRadius: 18,
    height: 20,
    marginTop: -2,
    width: 42,
  },
  stopIcon: { backgroundColor: Colors.surface, borderRadius: 7, height: 30, width: 30 },
  captureStatus: { color: Colors.surface, fontSize: 15, fontWeight: '800' },
  liveRow: { alignItems: 'center', flexDirection: 'row', gap: 7, maxWidth: 300 },
  liveDot: { backgroundColor: '#FDE68A', borderRadius: 5, height: 8, width: 8 },
  liveText: { color: '#E0E7FF', flex: 1, fontSize: 12, lineHeight: 17 },
  quickActions: { flexDirection: 'row', gap: 10 },
  tipCard: { backgroundColor: Colors.accentSoft, borderRadius: 18, gap: 4, padding: 16 },
  tipTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  tipCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  resumeCard: {
    alignItems: 'center',
    backgroundColor: Colors.brandSoft,
    borderColor: Colors.focus,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 14,
  },
  resumeCopyBlock: { flex: 1, gap: 3 },
  resumeTitle: { color: Colors.ink, fontSize: 15, fontWeight: '900' },
  resumeCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  resumeButton: { minHeight: 42, paddingHorizontal: 13 },
  retryCard: { backgroundColor: Colors.dangerSoft, borderRadius: 18, gap: 8, padding: 18 },
  retryTitle: { color: Colors.ink, fontSize: 16, fontWeight: '800' },
  retryCopy: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: Colors.danger, fontSize: 14, marginTop: 4 },
});
