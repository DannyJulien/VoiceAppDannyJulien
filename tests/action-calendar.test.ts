import { describe, expect, it } from '@jest/globals';

import {
  actionEventDescription,
  actionIcsFilename,
  createActionIcsEvent,
  type CalendarAction,
} from '@/features/actions/action-calendar';

const scheduled: CalendarAction = {
  action_type: 'task',
  id: 'a1b2',
  scheduled_at: '2026-09-04T09:15:00.000Z',
  summary: 'Bring the signed quote.',
  title: 'Call the roofer',
};

describe('adding a dated item to your own calendar', () => {
  it('creates an event that starts on the planned moment and lasts 30 minutes', () => {
    const ics = createActionIcsEvent(scheduled);

    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('DTSTART:20260904T091500Z');
    expect(ics).toContain('DTEND:20260904T094500Z');
    expect(ics).toContain('SUMMARY:Call the roofer');
    expect(ics).toContain('UID:action-a1b2@handled');
  });

  it('honours a custom duration', () => {
    expect(createActionIcsEvent(scheduled, 90)).toContain('DTEND:20260904T104500Z');
  });

  it('refuses an item without a date instead of exporting an invalid event', () => {
    expect(() => createActionIcsEvent({ ...scheduled, scheduled_at: null })).toThrow(
      'Add a date to this item before sending it to your calendar.',
    );
  });

  it('describes the item with its type and summary', () => {
    expect(actionEventDescription(scheduled)).toBe(
      'Task\n\nBring the signed quote.\n\nPlanned in Handled.',
    );
  });

  it('leaves out an empty summary', () => {
    expect(actionEventDescription({ ...scheduled, summary: '   ' })).toBe(
      'Task\n\nPlanned in Handled.',
    );
  });

  it('builds a safe filename from the title', () => {
    expect(actionIcsFilename(scheduled)).toBe('handled-call-the-roofer.ics');
    expect(actionIcsFilename({ ...scheduled, title: '!!!' })).toBe('handled-item.ics');
  });
});
