import { describe, expect, it } from '@jest/globals';

import {
  actionTypeLabel,
  calendarMonthDays,
  localDateKey,
  normalizedSchedule,
  statusLabel,
} from '@/features/actions/action-utils';

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

  it('treats date and time text as the user’s local date instead of UTC text', () => {
    expect(normalizedSchedule('2026-08-23 16:30')).toBe(
      new Date(2026, 7, 23, 16, 30).toISOString(),
    );
    expect(normalizedSchedule('2026-02-29 08:00')).toBeUndefined();
    expect(localDateKey(new Date(2026, 0, 2, 0, 30))).toBe('2026-01-02');
  });

  it('builds a local calendar grid for a month', () => {
    const days = calendarMonthDays(new Date(2026, 7, 1));
    expect(days).toHaveLength(37);
    expect(localDateKey(days.at(-1)!)).toBe('2026-08-31');
  });
});
