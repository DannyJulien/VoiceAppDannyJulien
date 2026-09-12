import AsyncStorage from '@react-native-async-storage/async-storage';

const pendingTypedCapturesKey = 'handled.pending-typed-captures.v1';

export type PendingTypedCapture = {
  createdAt: string;
  id: string;
  projectId: string | null;
  text: string;
  timezone: string;
  userId: string;
};

export type PendingTypedCaptureInput = Omit<PendingTypedCapture, 'createdAt'> & {
  createdAt?: string;
};

export type KeyValueStorage = Pick<typeof AsyncStorage, 'getItem' | 'setItem'>;

function isPendingTypedCapture(value: unknown): value is PendingTypedCapture {
  if (!value || typeof value !== 'object') return false;
  const capture = value as Record<string, unknown>;
  return (
    typeof capture.createdAt === 'string' &&
    typeof capture.id === 'string' &&
    (typeof capture.projectId === 'string' || capture.projectId === null) &&
    typeof capture.text === 'string' &&
    typeof capture.timezone === 'string' &&
    typeof capture.userId === 'string'
  );
}

async function readPendingTypedCaptures(storage: KeyValueStorage = AsyncStorage) {
  const value = await storage.getItem(pendingTypedCapturesKey);
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter(isPendingTypedCapture) : [];
  } catch {
    return [];
  }
}

async function writePendingTypedCaptures(
  captures: PendingTypedCapture[],
  storage: KeyValueStorage = AsyncStorage,
) {
  await storage.setItem(pendingTypedCapturesKey, JSON.stringify(captures));
}

async function removePendingTypedCapture(
  id: string,
  storage: KeyValueStorage = AsyncStorage,
) {
  const captures = await readPendingTypedCaptures(storage);
  await writePendingTypedCaptures(captures.filter((capture) => capture.id !== id), storage);
}

export async function queuePendingTypedCapture(
  input: PendingTypedCaptureInput,
  storage: KeyValueStorage = AsyncStorage,
) {
  const captures = await readPendingTypedCaptures(storage);
  const existing = captures.find((capture) => capture.id === input.id);
  if (existing) return existing;

  const pendingCapture: PendingTypedCapture = {
    ...input,
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
  await writePendingTypedCaptures([...captures, pendingCapture], storage);
  return pendingCapture;
}

export async function getPendingTypedCaptureCount(
  userId: string,
  storage: KeyValueStorage = AsyncStorage,
) {
  return (await readPendingTypedCaptures(storage)).filter((capture) => capture.userId === userId)
    .length;
}

export type SyncPendingTypedCapture = (capture: PendingTypedCapture) => Promise<unknown>;

/**
 * Keep failed notes in the durable outbox. The caller supplies the sync operation so this
 * storage primitive has no dependency on the AI or Supabase client.
 */
export async function retryPendingTypedCaptures(
  userId: string,
  syncCapture: SyncPendingTypedCapture,
  storage: KeyValueStorage = AsyncStorage,
) {
  const captures = (await readPendingTypedCaptures(storage)).filter(
    (capture) => capture.userId === userId,
  );
  let syncedCount = 0;

  for (const capture of captures) {
    try {
      await syncCapture(capture);
      await removePendingTypedCapture(capture.id, storage);
      syncedCount += 1;
    } catch {
      // The user can safely retry later. capture.id is reused server-side to prevent duplicates.
    }
  }

  return {
    pendingCount: captures.length - syncedCount,
    syncedCount,
  };
}
