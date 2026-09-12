import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
  },
}));

import {
  type KeyValueStorage,
  getPendingTypedCaptureCount,
  queuePendingTypedCapture,
  retryPendingTypedCaptures,
} from '@/features/captures/typed-capture-outbox';

function memoryStorage(): KeyValueStorage {
  const values = new Map<string, string>();
  return {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => {
      values.set(key, value);
    },
  };
}

const capture = {
  id: '2a3ac96e-546f-4bea-89f2-14217e756ad5',
  projectId: null,
  text: 'Book the train tickets for Brussels tomorrow.',
  timezone: 'Europe/Brussels',
  userId: '76cb42db-75a6-466d-92a7-153233db7a34',
};

describe('typed capture outbox', () => {
  it('keeps an offline typed note until a successful sync', async () => {
    const storage = memoryStorage();
    await queuePendingTypedCapture(capture, storage);

    expect(await getPendingTypedCaptureCount(capture.userId, storage)).toBe(1);

    const failed = await retryPendingTypedCaptures(
      capture.userId,
      async () => Promise.reject(new Error('offline')),
      storage,
    );
    expect(failed).toEqual({ pendingCount: 1, syncedCount: 0 });
    expect(await getPendingTypedCaptureCount(capture.userId, storage)).toBe(1);

    const synced = await retryPendingTypedCaptures(capture.userId, async () => undefined, storage);
    expect(synced).toEqual({ pendingCount: 0, syncedCount: 1 });
    expect(await getPendingTypedCaptureCount(capture.userId, storage)).toBe(0);
  });

  it('does not queue the same capture id twice', async () => {
    const storage = memoryStorage();
    await queuePendingTypedCapture(capture, storage);
    await queuePendingTypedCapture({ ...capture, text: 'Changed text should not replace it.' }, storage);

    expect(await getPendingTypedCaptureCount(capture.userId, storage)).toBe(1);
  });
});
