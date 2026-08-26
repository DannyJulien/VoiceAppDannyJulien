export const NETWORK_TIMEOUT_MESSAGE =
  'The connection took too long. Check your internet connection and try again.';

export const DEFAULT_NETWORK_TIMEOUT_MS = 12_000;

export function isNetworkTimeoutError(error: unknown) {
  return error instanceof Error && error.message === NETWORK_TIMEOUT_MESSAGE;
}

export async function fetchWithTimeout(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  timeoutMs = DEFAULT_NETWORK_TIMEOUT_MS,
) {
  const controller = new AbortController();
  let didTimeOut = false;
  const abortFromCaller = () => controller.abort();

  if (init?.signal?.aborted) {
    controller.abort();
  } else {
    init?.signal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeout = setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    return await globalThis.fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (didTimeOut) throw new Error(NETWORK_TIMEOUT_MESSAGE);
    throw error;
  } finally {
    clearTimeout(timeout);
    init?.signal?.removeEventListener('abort', abortFromCaller);
  }
}
