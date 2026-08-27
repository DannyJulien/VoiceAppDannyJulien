import { describe, expect, it } from '@jest/globals';

import {
  DEFAULT_NETWORK_TIMEOUT_MS,
  EDGE_FUNCTION_TIMEOUT_MS,
  timeoutForRequest,
} from '@/services/supabase/fetch-with-timeout';

describe('Supabase request timeouts', () => {
  it('allows longer-running AI Edge Functions to complete', () => {
    expect(timeoutForRequest('https://project.supabase.co/functions/v1/research')).toBe(
      EDGE_FUNCTION_TIMEOUT_MS,
    );
  });

  it('keeps normal database and auth requests responsive', () => {
    expect(timeoutForRequest('https://project.supabase.co/rest/v1/actions')).toBe(
      DEFAULT_NETWORK_TIMEOUT_MS,
    );
  });
});
