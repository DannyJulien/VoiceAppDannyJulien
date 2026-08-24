import { describe, expect, it, jest } from '@jest/globals';

import { recordingPermissionError } from '@/features/captures/recording-permission';
import { shareOrCopy } from '@/features/share/share-utils';

describe('web capture and sharing utilities', () => {
  it('provides a clear message when microphone permission is denied', () => {
    expect(recordingPermissionError()).toMatch(/Microphone access is needed/);
  });

  it('falls back to copying when the Web Share API is unavailable', async () => {
    const copy = jest.fn(async () => undefined);

    await expect(shareOrCopy({ copy })).resolves.toBe('copied');
    expect(copy).toHaveBeenCalledTimes(1);
  });
});
