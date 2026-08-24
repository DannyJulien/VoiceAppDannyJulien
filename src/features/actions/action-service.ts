import type { ActionStatus, ActionType, Database } from '@/types/database';

import { actionTypeForIntent, type UnderstoodAction } from '@/features/actions/action-schema';
import { getSupabaseClient } from '@/services/supabase/client';

export type SavedAction = Database['public']['Tables']['actions']['Row'];
export type ActionFilter = 'all' | ActionType;

export type ActionReviewInput = {
  action: UnderstoodAction;
  captureId: string;
  timezone: string;
  userId: string;
};

export async function saveReviewedAction({
  action,
  captureId,
  timezone,
  userId,
}: ActionReviewInput) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .insert({
      action_type: actionTypeForIntent(action.intent),
      clarification_question: action.clarificationQuestion,
      confidence: action.confidence,
      message_draft: action.messageDraft,
      requires_clarification: action.requiresClarification,
      scheduled_at: action.scheduledAt,
      scheduled_timezone: action.scheduledAt ? timezone : null,
      status: 'approved',
      summary: action.summary || null,
      title: action.title,
      user_id: userId,
      voice_capture_id: captureId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getActions(userId: string, filter: ActionFilter) {
  let query = getSupabaseClient()
    .from('actions')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (filter !== 'all') query = query.eq('action_type', filter);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function getAction(actionId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .select()
    .eq('id', actionId)
    .eq('user_id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getCaptureTranscript(captureId: string | null, userId: string) {
  if (!captureId) return null;

  const { data, error } = await getSupabaseClient()
    .from('voice_captures')
    .select('transcript')
    .eq('id', captureId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.transcript ?? null;
}

export async function updateAction(
  actionId: string,
  userId: string,
  update: Database['public']['Tables']['actions']['Update'],
) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .update(update)
    .eq('id', actionId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function setActionStatus(actionId: string, userId: string, status: ActionStatus) {
  return updateAction(actionId, userId, { status });
}

export async function deleteAction(actionId: string, userId: string) {
  const { error } = await getSupabaseClient()
    .from('actions')
    .delete()
    .eq('id', actionId)
    .eq('user_id', userId);

  if (error) throw error;
}
