import type { ActionCategory, ActionStatus, ActionType, Database, Json } from '@/types/database';

import { actionTypeForIntent, type UnderstoodAction } from '@/features/actions/action-schema';
import { createContact, getContacts } from '@/features/contacts/contact-service';
import { findOrCreateProject } from '@/features/projects/project-service';
import { getSupabaseClient } from '@/services/supabase/client';

export type SavedAction = Database['public']['Tables']['actions']['Row'];
export type ActionFilter = 'all' | ActionType;

export type ActionReviewInput = {
  action: UnderstoodAction;
  captureId: string;
  timezone: string;
  userId: string;
  category?: ActionCategory;
  projectId?: string | null;
};

export type ManualNoteInput = {
  category: ActionCategory;
  contactId?: string | null;
  projectId?: string | null;
  scheduledAt?: string | null;
  summary: string;
  title: string;
  timezone?: string;
  userId: string;
};

export type PendingActionInput = Pick<
  ActionReviewInput,
  'action' | 'captureId' | 'timezone' | 'userId'
>;
export type SuggestedPerson = { name: string; role: 'recipient' | 'mentioned' };

export function suggestedPeopleFrom(value: Json): SuggestedPerson[] {
  if (!Array.isArray(value)) return [];
  return value.filter((person): person is SuggestedPerson => {
    if (!person || typeof person !== 'object' || Array.isArray(person)) return false;
    const candidate = person as { name?: unknown; role?: unknown };
    return (
      typeof candidate.name === 'string' &&
      candidate.name.trim().length > 0 &&
      (candidate.role === 'recipient' || candidate.role === 'mentioned')
    );
  });
}

export async function saveReviewedAction({
  action,
  captureId,
  timezone,
  userId,
  category = 'inbox',
  projectId = null,
}: ActionReviewInput) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .insert({
      action_type: actionTypeForIntent(action.intent),
      clarification_question: action.clarificationQuestion,
      category,
      confidence: action.confidence,
      message_draft: action.messageDraft,
      requires_clarification: action.requiresClarification,
      project_id: projectId,
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

export async function createPendingAction({
  action,
  captureId,
  timezone,
  userId,
}: PendingActionInput) {
  const client = getSupabaseClient();
  const { data: existing, error: existingError } = await client
    .from('actions')
    .select()
    .eq('voice_capture_id', captureId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await client
    .from('actions')
    .insert({
      action_type: actionTypeForIntent(action.intent),
      category: 'inbox',
      clarification_question: action.clarificationQuestion,
      confidence: action.confidence,
      message_draft: action.messageDraft,
      requires_clarification: action.requiresClarification,
      scheduled_at: action.scheduledAt,
      scheduled_timezone: action.scheduledAt ? timezone : null,
      status: 'pending',
      suggested_category: action.suggestedCategory,
      suggested_project_name: action.suggestedProjectName,
      suggested_people: action.people,
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

export type PendingApprovalInput = {
  category?: ActionCategory;
  people?: SuggestedPerson[];
  projectName?: string | null;
};

export async function approvePendingAction(
  action: SavedAction,
  userId: string,
  {
    category = action.suggested_category ?? 'inbox',
    people = suggestedPeopleFrom(action.suggested_people),
    projectName = action.suggested_project_name,
  }: PendingApprovalInput = {},
) {
  const project = projectName?.trim() ? await findOrCreateProject(userId, projectName) : null;
  const contacts = await getContacts(userId);
  for (const person of people) {
    const normalizedName = person.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    let contact = contacts.find(
      (candidate) =>
        candidate.name.trim().replace(/\s+/g, ' ').toLocaleLowerCase() === normalizedName,
    );
    if (!contact) {
      contact = await createContact(userId, { name: person.name });
      contacts.push(contact);
    }
    const { error } = await getSupabaseClient()
      .from('action_people')
      .upsert(
        { action_id: action.id, person_id: contact.id, role: person.role },
        { onConflict: 'action_id,person_id,role', ignoreDuplicates: true },
      );
    if (error) throw error;
  }
  return updateAction(action.id, userId, {
    category,
    project_id: project?.id ?? action.project_id,
    status: 'approved',
    suggested_category: null,
    suggested_project_name: null,
    suggested_people: [],
  });
}

export async function createManualNote({
  category,
  contactId = null,
  projectId = null,
  scheduledAt = null,
  summary,
  title,
  timezone = 'UTC',
  userId,
}: ManualNoteInput) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('actions')
    .insert({
      action_type: 'note',
      category,
      project_id: projectId,
      scheduled_at: scheduledAt,
      scheduled_timezone: scheduledAt ? timezone : null,
      status: 'approved',
      summary: summary.trim() || null,
      title: title.trim(),
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;

  if (contactId) {
    const { error: contactError } = await client.from('action_people').insert({
      action_id: data.id,
      person_id: contactId,
      role: 'mentioned',
    });
    if (contactError) throw contactError;
  }

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

export async function getProjectActions(projectId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .select()
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getScheduledActions(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .select()
    .eq('user_id', userId)
    .not('scheduled_at', 'is', null)
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true });
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
