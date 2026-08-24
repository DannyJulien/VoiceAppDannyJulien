import type { ActionStatus, ActionType } from '@/types/database';

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

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
