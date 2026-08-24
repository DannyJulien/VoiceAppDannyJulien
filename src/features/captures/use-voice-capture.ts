import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';

import { understoodActionSchema, type UnderstoodAction } from '@/features/actions/action-schema';
import {
  discardPendingCaptures,
  getPendingCaptureCount,
  queueAndUploadCapture,
  retryPendingCaptures,
} from '@/features/captures/capture-service';
import { messageForCaptureError } from '@/features/captures/capture-utils';
import { recordingPermissionError } from '@/features/captures/recording-permission';
import { getSupabaseClient } from '@/services/supabase/client';

type CapturePhase = 'idle' | 'recording' | 'uploading' | 'understanding' | 'uploaded' | 'error';

export type { UnderstoodAction } from '@/features/actions/action-schema';

const recordingOptions = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const };
const processCaptureFunction = 'process-captur';

async function messageForProcessingError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }

  return messageForCaptureError(error);
}

export function useVoiceCapture(userId: string | undefined) {
  const recorder = useAudioRecorder(recordingOptions);
  const recorderState = useAudioRecorderState(recorder, 250);
  const [phase, setPhase] = useState<CapturePhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [action, setAction] = useState<UnderstoodAction | null>(null);
  const [lastCaptureId, setLastCaptureId] = useState<string | null>(null);

  const refreshPendingCount = useCallback(async () => {
    if (!userId) return;
    setPendingCount(await getPendingCaptureCount(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isCurrent = true;
    void getPendingCaptureCount(userId).then((count) => {
      if (isCurrent) setPendingCount(count);
    });

    return () => {
      isCurrent = false;
    };
  }, [userId]);

  const startRecording = useCallback(async () => {
    setError(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPhase('error');
      setError(recordingPermissionError());
      return;
    }

    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setPhase('recording');
    } catch (recordingError) {
      setPhase('error');
      setError(messageForCaptureError(recordingError));
    }
  }, [recorder]);

  const processCapture = useCallback(async (captureId: string) => {
    setPhase('understanding');
    const { data, error: aiError } = await getSupabaseClient().functions.invoke(
      processCaptureFunction,
      {
        body: {
          captureId,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        },
      },
    );

    if (aiError || !data?.action) {
      throw aiError ?? new Error('AI processing did not return an action.');
    }

    const parsedAction = understoodActionSchema.safeParse(data.action);
    if (!parsedAction.success) throw new Error('AI returned an invalid action. Please try again.');

    setAction(parsedAction.data);
    setPhase('uploaded');
  }, []);

  const stopRecording = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setPhase('uploading');

    try {
      await recorder.stop();
      const localUri = recorder.uri;
      if (!localUri) throw new Error('The recording could not be saved. Please try again.');

      const captureId = await queueAndUploadCapture(localUri, userId);
      setLastCaptureId(captureId);
      await processCapture(captureId);
      await refreshPendingCount();
    } catch (uploadError) {
      setPhase('error');
      setError(await messageForProcessingError(uploadError));
      await refreshPendingCount();
    }
  }, [processCapture, recorder, refreshPendingCount, userId]);

  const retryProcessing = useCallback(async () => {
    if (!lastCaptureId) return;

    setError(null);
    try {
      await processCapture(lastCaptureId);
    } catch (processingError) {
      setPhase('error');
      setError(await messageForProcessingError(processingError));
    }
  }, [lastCaptureId, processCapture]);

  const retryUploads = useCallback(async () => {
    if (!userId) return;
    setError(null);
    setPhase('uploading');
    try {
      const result = await retryPendingCaptures(userId);
      setPendingCount(result.pendingCount);
      if (result.pendingCount > 0) {
        setPhase('error');
        setError('Upload still needs a connection. Your recording remains safely on this device.');
        return;
      }

      const captureId = result.uploadedCaptureIds.at(-1);
      if (!captureId) {
        setPhase('idle');
        return;
      }

      setLastCaptureId(captureId);
      await processCapture(captureId);
      await refreshPendingCount();
    } catch (retryError) {
      setPhase('error');
      setError(await messageForProcessingError(retryError));
      await refreshPendingCount();
    }
  }, [processCapture, refreshPendingCount, userId]);

  const discardPendingUploads = useCallback(async () => {
    if (!userId) return;
    await discardPendingCaptures(userId);
    setPendingCount(0);
    setError(null);
    setPhase('idle');
  }, [userId]);

  const takeActionForReview = useCallback(() => {
    if (!action || !lastCaptureId) return null;
    setAction(null);
    return { action, captureId: lastCaptureId };
  }, [action, lastCaptureId]);

  return {
    action,
    clearAction: () => setAction(null),
    discardPendingUploads,
    durationMillis: recorderState.durationMillis,
    error,
    isRecording: recorderState.isRecording,
    pendingCount,
    phase,
    canRetryProcessing: lastCaptureId !== null && phase === 'error' && pendingCount === 0,
    retryProcessing,
    retryUploads,
    startRecording,
    stopRecording,
    takeActionForReview,
  };
}
