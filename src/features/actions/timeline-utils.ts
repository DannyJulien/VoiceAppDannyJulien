import type { SavedAction } from '@/features/actions/action-service';

import { localDateKey } from '@/features/actions/action-utils';

type TimelineAction = Pick<SavedAction, 'created_at' | 'id' | 'scheduled_at' | 'status'>;

export type TodayActionGroups<T extends TimelineAction> = {
  overdue: T[];
  today: T[];
};

export type TimelineHistoryGroup<T extends TimelineAction> = {
  actions: T[];
  key: string;
  label: string;
};

function validTime(value: string | null) {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
}

function sortByScheduledTime<T extends TimelineAction>(actions: T[]) {
  return [...actions].sort((left, right) => {
    const leftTime = validTime(left.scheduled_at) ?? Number.POSITIVE_INFINITY;
    const rightTime = validTime(right.scheduled_at) ?? Number.POSITIVE_INFINITY;
    return leftTime - rightTime;
  });
}

/**
 * Returns the active approved work that belongs at the top of Today. A completed
 * item remains in History, rather than continuing to ask for attention here.
 */
export function getTodayActionGroups<T extends TimelineAction>(
  actions: T[],
  now = new Date(),
): TodayActionGroups<T> {
  const todayKey = localDateKey(now);
  if (!todayKey) return { overdue: [], today: [] };

  const scheduled = actions.filter(
    (action) => action.status === 'approved' && localDateKey(action.scheduled_at ?? '') !== null,
  );

  return {
    overdue: sortByScheduledTime(
      scheduled.filter((action) => {
        const scheduledKey = localDateKey(action.scheduled_at ?? '');
        return scheduledKey !== null && scheduledKey < todayKey;
      }),
    ),
    today: sortByScheduledTime(
      scheduled.filter((action) => localDateKey(action.scheduled_at ?? '') === todayKey),
    ),
  };
}

export function historyDateLabel(value: string, now = new Date()) {
  const dateKey = localDateKey(value);
  const todayKey = localDateKey(now);
  if (!dateKey || !todayKey) return 'Unknown date';
  if (dateKey === todayKey) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateKey === localDateKey(yesterday)) return 'Yesterday';

  const date = new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
  }).format(date);
}

/** Keeps the archive scannable without turning it into another type-filtered list. */
export function groupActionsByCreatedDate<T extends TimelineAction>(
  actions: T[],
  now = new Date(),
): TimelineHistoryGroup<T>[] {
  const groups = new Map<string, TimelineHistoryGroup<T>>();
  const newestFirst = [...actions].sort(
    (left, right) => (validTime(right.created_at) ?? 0) - (validTime(left.created_at) ?? 0),
  );

  newestFirst.forEach((action) => {
    const key = localDateKey(action.created_at) ?? 'unknown-date';
    const group = groups.get(key);
    if (group) {
      group.actions.push(action);
      return;
    }
    groups.set(key, {
      actions: [action],
      key,
      label: historyDateLabel(action.created_at, now),
    });
  });

  return [...groups.values()];
}
