import type { ActionCategory } from '@/types/database';

export const categories: { value: ActionCategory; label: string; color: string }[] = [
  { value: 'inbox', label: 'Inbox', color: '#5D6B82' },
  { value: 'work', label: 'Work', color: '#2563EB' },
  { value: 'personal', label: 'Personal', color: '#C0268A' },
  { value: 'meeting', label: 'Meetings', color: '#0F9F8A' },
  { value: 'idea', label: 'Ideas', color: '#C76A00' },
];

export const projectColors = ['#2563EB', '#0F9F8A', '#C0268A', '#C76A00', '#0E7490'];
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
