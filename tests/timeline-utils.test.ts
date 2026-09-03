import { describe, expect, it } from '@jest/globals';

import {
  getTodayActionGroups,
  groupActionsByCreatedDate,
  historyDateLabel,
} from '@/features/actions/timeline-utils';

type TimelineFixture = {
  created_at: string;
  id: string;
  scheduled_at: string | null;
  status: 'approved' | 'completed' | 'pending';
};

function at(year: number, month: number, day: number, hour = 9) {
  return new Date(year, month - 1, day, hour).toISOString();
}

function action(
  overrides: Partial<TimelineFixture> & Pick<TimelineFixture, 'id'>,
): TimelineFixture {
  return {
    created_at: at(2026, 9, 3),
    scheduled_at: null,
    status: 'approved',
    ...overrides,
  };
}

describe('Today action groups', () => {
  const now = new Date(2026, 8, 3, 10);

  it('shows approved dated work for today and overdue work, in due-time order', () => {
    const groups = getTodayActionGroups(
      [
        action({ id: 'later-today', scheduled_at: at(2026, 9, 3, 16) }),
        action({ id: 'overdue-later', scheduled_at: at(2026, 9, 2, 16) }),
        action({ id: 'overdue-first', scheduled_at: at(2026, 9, 1, 9) }),
        action({ id: 'earlier-today', scheduled_at: at(2026, 9, 3, 11) }),
      ],
      now,
    );

    expect(groups.overdue.map((item) => item.id)).toEqual(['overdue-first', 'overdue-later']);
    expect(groups.today.map((item) => item.id)).toEqual(['earlier-today', 'later-today']);
  });

  it('does not bring pending or completed items back into Today', () => {
    const groups = getTodayActionGroups(
      [
        action({ id: 'pending', scheduled_at: at(2026, 9, 3), status: 'pending' }),
        action({ id: 'completed', scheduled_at: at(2026, 9, 3), status: 'completed' }),
      ],
      now,
    );

    expect(groups.overdue).toEqual([]);
    expect(groups.today).toEqual([]);
  });
});

describe('History grouping', () => {
  const now = new Date(2026, 8, 3, 10);

  it('groups the full archive by understandable local dates, newest first', () => {
    const groups = groupActionsByCreatedDate(
      [
        action({ id: 'yesterday', created_at: at(2026, 9, 2, 18) }),
        action({ id: 'today-first', created_at: at(2026, 9, 3, 8) }),
        action({ id: 'today-last', created_at: at(2026, 9, 3, 14) }),
      ],
      now,
    );

    expect(groups.map((group) => group.label)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].actions.map((item) => item.id)).toEqual(['today-last', 'today-first']);
  });

  it('formats older dates and protects the UI from invalid timestamps', () => {
    expect(historyDateLabel(at(2026, 8, 29), now)).not.toBe('Today');
    expect(historyDateLabel('not-a-date', now)).toBe('Unknown date');
  });
});
