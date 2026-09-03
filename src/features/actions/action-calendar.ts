import { createIcsEvent } from '@/features/meetings/meeting-utils';
import type { ActionType } from '@/types/database';

import { actionTypeLabel } from './action-utils';

export const ACTION_EVENT_MINUTES = 30;

export type CalendarAction = {
  action_type: ActionType;
  id: string;
  location?: string | null;
  scheduled_at: string | null;
  summary?: string | null;
  title: string;
};

function endFromStart(start: string, minutes: number) {
  const date = new Date(start);
  if (Number.isNaN(date.getTime())) throw new Error('This item has no usable date yet.');
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

export function actionEventDescription(action: CalendarAction) {
  const lines = [actionTypeLabel(action.action_type)];
  if (action.summary?.trim()) lines.push('', action.summary.trim());
  lines.push('', 'Planned in Handled.');
  return lines.join('\n');
}

export function actionIcsFilename(action: CalendarAction) {
  const slug = action.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return `handled-${slug || 'item'}.ics`;
}

export function createActionIcsEvent(action: CalendarAction, minutes = ACTION_EVENT_MINUTES) {
  if (!action.scheduled_at) {
    throw new Error('Add a date to this item before sending it to your calendar.');
  }
  return createIcsEvent({
    description: actionEventDescription(action),
    end: endFromStart(action.scheduled_at, minutes),
    location: action.location,
    start: action.scheduled_at,
    title: action.title,
    uid: `action-${action.id}@handled`,
  });
}
