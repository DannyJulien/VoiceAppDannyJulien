import { describe, expect, it } from '@jest/globals';

import { actionTypeLabel, normalizedSchedule, statusLabel } from '@/features/actions/action-utils';

describe('action utilities', () => {
  it('formats action labels for the inbox', () => {
    expect(actionTypeLabel('reminder')).toBe('Reminder');
    expect(statusLabel('completed')).toBe('Completed');
  });

  it('normalizes a valid schedule and rejects invalid values', () => {
    expect(normalizedSchedule('')).toBeNull();
    expect(normalizedSchedule('not a date')).toBeUndefined();
    expect(normalizedSchedule('2026-08-23T16:30:00Z')).toBe('2026-08-23T16:30:00.000Z');
  });
});
