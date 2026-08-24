import { describe, expect, it } from '@jest/globals';

import { createIcsEvent } from '@/features/meetings/meeting-utils';

describe('ICS calendar export', () => {
  it('creates a valid UTC calendar event and escapes special characters', () => {
    const ics = createIcsEvent({
      description: 'Discuss AI, regulation; and a new line\nwith a backslash \\ safely.',
      start: '2026-08-23T16:30:00.000Z',
      title: 'Customer, AI; strategy',
      uid: 'meeting-123@handled',
    });

    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20260823T163000Z');
    expect(ics).toContain('SUMMARY:Customer\\, AI\\; strategy');
    expect(ics).toContain(
      'DESCRIPTION:Discuss AI\\, regulation\\; and a new line\\nwith a backslash \\\\ safely.',
    );
    expect(ics).toContain('END:VCALENDAR');
  });
});
