import { describe, expect, it } from '@jest/globals';

import {
  actionTypeLabel,
  approvedActionUpdate,
  calendarMonthDays,
  checklistItemsFrom,
  isChecklistAppendProposal,
  localDateKey,
  localDateTimeInputValue,
  normalizedSchedule,
  statusLabel,
} from '@/features/actions/action-utils';

describe('approving a pending capture', () => {
  it('moves the row to the timeline and spends every suggestion in the same update', () => {
    expect(approvedActionUpdate({ category: 'work', project_id: 'project-1' })).toEqual({
      auto_filed_at: null,
      category: 'work',
      project_id: 'project-1',
      status: 'approved',
      suggested_category: null,
      suggested_people: [],
      suggested_project_name: null,
    });
  });

  it('carries the edited fields along, including an explicit no-project and no-date', () => {
    const update = approvedActionUpdate({
      category: 'personal',
      project_id: null,
      scheduled_at: null,
      scheduled_timezone: null,
      summary: null,
      title: 'Call the dentist',
    });
    expect(update).toMatchObject({
      project_id: null,
      scheduled_at: null,
      scheduled_timezone: null,
      status: 'approved',
      summary: null,
      title: 'Call the dentist',
    });
  });

  it('never lets an edit resurrect a suggestion or the auto-filed marker', () => {
    const update = approvedActionUpdate({
      ...({
        auto_filed_at: '2026-08-01T10:00:00.000Z',
        suggested_category: 'work',
        suggested_project_name: 'Kitchen',
      } as object),
      category: 'idea',
      project_id: null,
    });
    expect(update.auto_filed_at).toBeNull();
    expect(update.suggested_category).toBeNull();
    expect(update.suggested_project_name).toBeNull();
  });
});

describe('checklist append proposals', () => {
  it('reads only usable strings out of the stored items', () => {
    expect(checklistItemsFrom(['Milk', ' ', 42, 'Eggs', null])).toEqual(['Milk', 'Eggs']);
    expect(checklistItemsFrom('Milk')).toEqual([]);
    expect(checklistItemsFrom(null)).toEqual([]);
  });

  it('recognizes a pending capture that adds items to an existing checklist', () => {
    expect(
      isChecklistAppendProposal({
        checklist_append_items: ['Milk'],
        checklist_target_action_id: 'checklist-1',
        status: 'pending',
      }),
    ).toBe(true);
  });

  it('treats every other pending capture as an ordinary note to edit', () => {
    expect(
      isChecklistAppendProposal({
        checklist_append_items: [],
        checklist_target_action_id: 'checklist-1',
        status: 'pending',
      }),
    ).toBe(false);
    expect(
      isChecklistAppendProposal({
        checklist_append_items: ['Milk'],
        checklist_target_action_id: null,
        status: 'pending',
      }),
    ).toBe(false);
    expect(
      isChecklistAppendProposal({
        checklist_append_items: ['Milk'],
        checklist_target_action_id: 'checklist-1',
        status: 'approved',
      }),
    ).toBe(false);
  });
});

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

describe('localDateTimeInputValue', () => {
  it('renders a stored ISO timestamp as the local datetime-local value', () => {
    const local = new Date(2026, 8, 4, 9, 5);
    expect(localDateTimeInputValue(local.toISOString())).toBe('2026-09-04T09:05');
  });

  it('passes a datetime-local value through unchanged', () => {
    expect(localDateTimeInputValue('2026-09-04T09:05')).toBe('2026-09-04T09:05');
  });

  it('shows an empty field for unset or unreadable values', () => {
    expect(localDateTimeInputValue(null)).toBe('');
    expect(localDateTimeInputValue('')).toBe('');
    expect(localDateTimeInputValue('next friday')).toBe('');
  });

  it('round-trips through normalizedSchedule without changing the instant', () => {
    const stored = new Date(2026, 8, 4, 9, 5).toISOString();
    expect(normalizedSchedule(localDateTimeInputValue(stored))).toBe(stored);
  });
});
