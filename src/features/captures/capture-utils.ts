export function formatDuration(durationMillis: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMillis / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function audioMetadata(uri: string) {
  const normalizedUri = uri.toLowerCase();

  // Expo Audio records audio/webm in a browser, but the browser exposes it as a blob: URL
  // without a filename extension. Keep the storage path aligned with the recorded bytes.
  if (normalizedUri.startsWith('blob:') || normalizedUri.endsWith('.webm')) {
    return { extension: 'webm', contentType: 'audio/webm' };
  }

  if (normalizedUri.endsWith('.3gp')) {
    return { extension: '3gp', contentType: 'audio/3gpp' };
  }

  return { extension: 'm4a', contentType: 'audio/mp4' };
}

export function messageForCaptureError(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message.includes('Failed to send a request to the Edge Function')) {
    return 'Your recording was uploaded, but the voice processor could not be reached. Tap retry to understand it.';
  }

  if (message) return message;
  return 'Your recording is safely kept on this device. Please try uploading again.';
}
