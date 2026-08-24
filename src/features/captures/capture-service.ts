import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

import { audioMetadata } from '@/features/captures/capture-utils';
import { getSupabaseClient } from '@/services/supabase/client';

const pendingCapturesKey = 'handled.pending-captures.v1';
const voiceCaptureBucket = 'voice-captures';

export type PendingCapture = {
  id: string;
  userId: string;
  localUri: string;
  storagePath: string;
  contentType: string;
  createdAt: string;
};

async function readPendingCaptures(): Promise<PendingCapture[]> {
  const value = await AsyncStorage.getItem(pendingCapturesKey);
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? (parsed as PendingCapture[]) : [];
  } catch {
    return [];
  }
}

async function writePendingCaptures(captures: PendingCapture[]) {
  await AsyncStorage.setItem(pendingCapturesKey, JSON.stringify(captures));
}

async function removePendingCapture(id: string) {
  const captures = await readPendingCaptures();
  await writePendingCaptures(captures.filter((capture) => capture.id !== id));
}

async function uploadPendingCapture(capture: PendingCapture) {
  const supabase = getSupabaseClient();
  const { error: captureError } = await supabase.from('voice_captures').upsert(
    {
      id: capture.id,
      user_id: capture.userId,
      processing_status: 'recorded',
    },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (captureError) throw captureError;

  const recordingResponse = await fetch(capture.localUri);
  if (!recordingResponse.ok) {
    throw new Error('The saved recording is no longer available on this device.');
  }
  const recordingBytes = await recordingResponse.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from(voiceCaptureBucket)
    .upload(capture.storagePath, recordingBytes, {
      contentType: capture.contentType,
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('voice_captures')
    .update({ audio_path: capture.storagePath, processing_status: 'uploaded' })
    .eq('id', capture.id);
  if (updateError) throw updateError;

  await removePendingCapture(capture.id);
}

export async function queueAndUploadCapture(localUri: string, userId: string) {
  const { extension, contentType } = audioMetadata(localUri);
  const id = randomUUID();
  const pendingCapture: PendingCapture = {
    id,
    userId,
    localUri,
    storagePath: `${userId}/${id}.${extension}`,
    contentType,
    createdAt: new Date().toISOString(),
  };

  const captures = await readPendingCaptures();
  await writePendingCaptures([...captures, pendingCapture]);
  await uploadPendingCapture(pendingCapture);
  return id;
}

export async function retryPendingCaptures(userId: string) {
  const pendingCaptures = (await readPendingCaptures()).filter(
    (capture) => capture.userId === userId,
  );
  let uploadedCount = 0;
  const uploadedCaptureIds: string[] = [];

  for (const capture of pendingCaptures) {
    try {
      await uploadPendingCapture(capture);
      uploadedCount += 1;
      uploadedCaptureIds.push(capture.id);
    } catch {
      // Keep every failed item in the durable queue for a later user-initiated retry.
    }
  }

  return {
    uploadedCaptureIds,
    uploadedCount,
    pendingCount: pendingCaptures.length - uploadedCount,
  };
}

export async function getPendingCaptureCount(userId: string) {
  return (await readPendingCaptures()).filter((capture) => capture.userId === userId).length;
}

export async function discardPendingCaptures(userId: string) {
  const captures = await readPendingCaptures();
  await writePendingCaptures(captures.filter((capture) => capture.userId !== userId));
}
