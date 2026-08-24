import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AppButton } from '@/components/app-button';
import { Screen } from '@/components/screen';
import { Colors } from '@/constants/theme';
import { useActionReview } from '@/features/actions/action-review-provider';
import { signOut } from '@/features/auth/auth-service';
import { useAuth } from '@/features/auth/auth-provider';
import { formatDuration } from '@/features/captures/capture-utils';
import { useVoiceCapture } from '@/features/captures/use-voice-capture';

export default function HomeScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { draft, setDraft } = useActionReview();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const voiceCapture = useVoiceCapture(session?.user.id);
  const {
    action,
    canRetryProcessing,
    discardPendingUploads,
    durationMillis,
    error: captureError,
    isRecording,
    pendingCount,
    phase,
    retryProcessing,
    retryUploads,
    startRecording,
    stopRecording,
    takeActionForReview,
  } = voiceCapture;
  const isBusy = phase === 'uploading' || phase === 'understanding';

  useEffect(() => {
    if (!action) return;

    const review = takeActionForReview();
    if (!review) return;

    setDraft({
      ...review,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
    });
    router.push('/review');
  }, [action, router, setDraft, takeActionForReview]);

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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
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
          <Text style={styles.title}>Clear your head.</Text>
          <Text style={styles.copy}>
            Record a thought. We turn it into something you can act on.
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
                ? `Recording ${formatDuration(durationMillis)}`
                : phase === 'understanding'
                  ? 'Making sense of it…'
                  : isBusy
                    ? 'Saving your recording…'
                    : phase === 'uploaded'
                      ? 'Saved. Preparing your action…'
                      : 'Tap to start recording'}
            </Text>
          </View>
        </View>

        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>One place for the follow-through</Text>
          <Text style={styles.tipCopy}>
            Find saved thoughts in Inbox, research a note, or send it to a person.
          </Text>
        </View>

        {draft ? (
          <View style={styles.resumeCard}>
            <View style={styles.resumeCopyBlock}>
              <Text style={styles.resumeTitle}>Your summary is ready</Text>
              <Text numberOfLines={2} style={styles.resumeCopy}>
                {draft.action.title}
              </Text>
            </View>
            <AppButton
              label="Review it"
              onPress={() => router.push('/review')}
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
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
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
    shadowColor: '#111827',
    shadowOpacity: 0.25,
    shadowRadius: 16,
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
