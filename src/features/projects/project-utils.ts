import type { ActionCategory } from '@/types/database';

export const categories: { value: ActionCategory; label: string; color: string }[] = [
  { value: 'inbox', label: 'Inbox', color: '#667085' },
  { value: 'work', label: 'Work', color: '#4F46E5' },
  { value: 'personal', label: 'Personal', color: '#DB2777' },
  { value: 'meeting', label: 'Meetings', color: '#0F766E' },
  { value: 'idea', label: 'Ideas', color: '#EA580C' },
];

export const projectColors = ['#4F46E5', '#0F766E', '#DB2777', '#EA580C', '#2563EB'];
export const maxProjectSummaryLength = 500;

type SupabaseError = {
  code?: unknown;
  message?: unknown;
};

export function normalizedProjectName(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

export function normalizedProjectSummary(summary: string) {
  return summary.trim().replace(/\s+/g, ' ');
}

export function isMissingProjectSummaryColumn(error: unknown) {
  if (!error || typeof error !== 'object') return false;

  const { code, message } = error as SupabaseError;
  const errorMessage = typeof message === 'string' ? message : '';
  return (
    (code === '42703' && /summary/i.test(errorMessage)) ||
    (code === 'PGRST204' && /summary/i.test(errorMessage))
  );
}

export function categoryDetails(category: ActionCategory) {
  return categories.find((item) => item.value === category) ?? categories[0];
}
