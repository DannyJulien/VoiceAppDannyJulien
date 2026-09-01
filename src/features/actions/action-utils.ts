import type { ActionCategory, ActionStatus, ActionType, Database, Json } from '@/types/database';

import { normalizeChecklistItems } from '@/features/actions/action-schema';

type ActionRow = Database['public']['Tables']['actions']['Row'];
type ActionUpdate = Database['public']['Tables']['actions']['Update'];

const localSchedulePattern = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

export function actionTypeLabel(type: ActionType | string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function formatActionWhen(value: string | null) {
  if (!value) return 'No time set';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function statusLabel(status: ActionStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function checklistItemsFrom(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeChecklistItems(value.filter((item): item is string => typeof item === 'string'));
}

/**
 * A pending capture that proposes items for an existing checklist. Approving it appends
 * the items and drops the capture, so its own title, date and category are never kept:
 * it is reviewed on the note detail, not in the editor.
 */
export function isChecklistAppendProposal(
  action: Pick<ActionRow, 'checklist_append_items' | 'checklist_target_action_id' | 'status'>,
) {
  return (
    action.status === 'pending' &&
    Boolean(action.checklist_target_action_id) &&
    checklistItemsFrom(action.checklist_append_items).length > 0
  );
}

export type ApprovedActionFields = {
  category: ActionCategory;
  project_id: string | null;
  scheduled_at?: string | null;
  scheduled_timezone?: string | null;
  summary?: string | null;
  title?: string;
};

/**
 * The single row update that takes a pending capture to the timeline. Everything the AI
 * suggested is spent by it, so a later edit or approval cannot re-apply a suggestion over
 * what the user settled here.
 */
export function approvedActionUpdate(fields: ApprovedActionFields): ActionUpdate {
  return {
    ...fields,
    auto_filed_at: null,
    status: 'approved',
    suggested_category: null,
    suggested_people: [],
    suggested_project_name: null,
  };
}

export function normalizedSchedule(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const localMatch = trimmed.match(localSchedulePattern);
  if (localMatch) {
    const [
      ,
      yearValue,
      monthValue,
      dayValue,
      hourValue = '0',
      minuteValue = '0',
      secondValue = '0',
    ] = localMatch;
    const year = Number(yearValue);
    const month = Number(monthValue);
    const day = Number(dayValue);
    const hour = Number(hourValue);
    const minute = Number(minuteValue);
    const second = Number(secondValue);
    const date = new Date(year, month - 1, day, hour, minute, second);
    const matchesRequestedLocalTime =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day &&
      date.getHours() === hour &&
      date.getMinutes() === minute &&
      date.getSeconds() === second;
    return matchesRequestedLocalTime ? date.toISOString() : undefined;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function localDateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function calendarMonthDays(month: Date) {
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return Array.from({ length: firstDay.getDay() + lastDay }, (_, index) => {
    const day = index - firstDay.getDay() + 1;
    return day > 0 ? new Date(month.getFullYear(), month.getMonth(), day) : null;
  });
}

export function formatCalendarDay(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return 'Unknown date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(date);
}

/**
 * The value a `datetime-local` input understands: `YYYY-MM-DDTHH:mm` in the device's
 * local time, without seconds or offset. A stored ISO timestamp is converted; a value
 * already in that shape passes through; anything unreadable becomes an empty field.
 */
export function localDateTimeInputValue(value: string | null) {
  if (!value?.trim()) return '';
  const date = new Date(value.trim());
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
