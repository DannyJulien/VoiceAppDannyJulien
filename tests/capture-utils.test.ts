import { describe, expect, it } from '@jest/globals';

import { audioMetadata, formatDuration } from '@/features/captures/capture-utils';

describe('capture utilities', () => {
  it('formats recording durations for the recording interface', () => {
    expect(formatDuration(61_900)).toBe('1:01');
  });

  it('uses a storage MIME type that matches the recording file', () => {
    expect(audioMetadata('file:///capture.webm')).toEqual({
      extension: 'webm',
      contentType: 'audio/webm',
    });
    expect(audioMetadata('blob:http://localhost:8081/recording')).toEqual({
      extension: 'webm',
      contentType: 'audio/webm',
    });
    expect(audioMetadata('file:///capture.m4a')).toEqual({
      extension: 'm4a',
      contentType: 'audio/mp4',
    });
  });
});
