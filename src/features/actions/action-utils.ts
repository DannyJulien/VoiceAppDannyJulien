import type { ActionStatus, ActionType } from '@/types/database';

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
