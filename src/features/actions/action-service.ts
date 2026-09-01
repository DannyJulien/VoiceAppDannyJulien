import type { ActionCategory, ActionStatus, ActionType, Database, Json } from '@/types/database';

import {
  actionTypeForIntent,
  normalizeChecklistItems,
  type UnderstoodAction,
} from '@/features/actions/action-schema';
import { projectIdForFiling, type FilingDecision } from '@/features/actions/filing-gate';
import { createContact, getContacts } from '@/features/contacts/contact-service';
import { normalizedContactName } from '@/features/contacts/contact-utils';
import { getProjects } from '@/features/projects/project-service';
import { normalizedProjectName } from '@/features/projects/project-utils';
import { getSupabaseClient } from '@/services/supabase/client';

export type SavedAction = Database['public']['Tables']['actions']['Row'];
export type ChecklistItem = Database['public']['Tables']['action_checklist_items']['Row'];
export type ChecklistCandidate = { id: string; items: string[]; title: string };
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
  'action' | 'captureId' | 'projectId' | 'timezone' | 'userId'
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

export function checklistItemsFrom(value: Json): string[] {
  if (!Array.isArray(value)) return [];
  return normalizeChecklistItems(value.filter((item): item is string => typeof item === 'string'));
}

async function ensureChecklistItems(
  actionId: string,
  userId: string,
  checklistItems: readonly string[],
) {
  if (!checklistItems.length) return;

  const client = getSupabaseClient();
  const { data: existing, error: existingError } = await client
    .from('action_checklist_items')
    .select('id')
    .eq('action_id', actionId)
    .eq('user_id', userId)
    .limit(1);
  if (existingError) throw existingError;
  if (existing.length) return;

  const { error } = await client.from('action_checklist_items').insert(
    checklistItems.map((title, position) => ({
      action_id: actionId,
      position,
      title,
      user_id: userId,
    })),
  );
  if (error) throw error;
}

async function getChecklistAction(actionId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .select()
    .eq('id', actionId)
    .eq('user_id', userId)
    .single();
  if (error) throw new Error('This checklist is no longer available.');
  return data;
}

async function reopenChecklistIfCompleted(action: SavedAction, userId: string) {
  if (action.status !== 'completed') return action;
  return updateAction(action.id, userId, { status: 'approved' });
}

export async function getOpenChecklistCandidates(userId: string): Promise<ChecklistCandidate[]> {
  const client = getSupabaseClient();
  const { data: itemRows, error: itemError } = await client
    .from('action_checklist_items')
    .select('action_id, title')
    .eq('user_id', userId)
    .order('position', { ascending: true })
    .limit(240);
  if (itemError) throw itemError;

  const itemsByAction = new Map<string, string[]>();
  for (const item of itemRows) {
    const items = itemsByAction.get(item.action_id) ?? [];
    items.push(item.title);
    itemsByAction.set(item.action_id, items);
  }
  const actionIds = [...itemsByAction.keys()].slice(0, 40);
  if (!actionIds.length) return [];

  const { data: actions, error: actionError } = await client
    .from('actions')
    .select('id, title')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .in('id', actionIds);
  if (actionError) throw actionError;

  return actions
    .map((action) => ({
      id: action.id,
      items: itemsByAction.get(action.id) ?? [],
      title: action.title,
    }))
    .filter((action) => action.items.length > 0)
    .slice(0, 40);
}

export async function appendActionChecklistItems(
  actionId: string,
  userId: string,
  titles: readonly string[],
) {
  const client = getSupabaseClient();
  const action = await getChecklistAction(actionId, userId);
  if (action.status === 'pending') throw new Error('Approve this checklist before adding items.');

  const { data: existing, error: existingError } = await client
    .from('action_checklist_items')
    .select()
    .eq('action_id', actionId)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (existingError) throw existingError;
  if (!existing.length) throw new Error('This note does not have a checklist yet.');

  const existingNames = new Set(existing.map((item) => item.title.trim().toLocaleLowerCase()));
  const additions = normalizeChecklistItems(titles).filter(
    (title) => !existingNames.has(title.toLocaleLowerCase()),
  );
  if (!additions.length) return action;
  if (existing.length + additions.length > 30) {
    throw new Error('A checklist can contain up to 30 items.');
  }

  const { error: insertError } = await client.from('action_checklist_items').insert(
    additions.map((title, offset) => ({
      action_id: actionId,
      position: existing.length + offset,
      title,
      user_id: userId,
    })),
  );
  if (insertError) throw insertError;
  return reopenChecklistIfCompleted(action, userId);
}

export async function createActionChecklistItem(
  actionId: string,
  userId: string,
  rawTitle: string,
) {
  const title = rawTitle.trim();
  if (!title) throw new Error('Add a checklist item first.');
  if (title.length > 280) throw new Error('Keep checklist items under 280 characters.');

  const client = getSupabaseClient();
  const action = await getChecklistAction(actionId, userId);
  const { data: existing, error: existingError } = await client
    .from('action_checklist_items')
    .select()
    .eq('action_id', actionId)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (existingError) throw existingError;
  if (existing.length >= 30) throw new Error('A checklist can contain up to 30 items.');
  if (
    existing.some((item) => item.title.trim().toLocaleLowerCase() === title.toLocaleLowerCase())
  ) {
    throw new Error('This item is already on the checklist.');
  }

  const { error } = await client.from('action_checklist_items').insert({
    action_id: actionId,
    position: existing.length,
    title,
    user_id: userId,
  });
  if (error) throw error;
  return reopenChecklistIfCompleted(action, userId);
}

export async function renameActionChecklistItem(itemId: string, userId: string, rawTitle: string) {
  const title = rawTitle.trim();
  if (!title) throw new Error('A checklist item needs a name.');
  if (title.length > 280) throw new Error('Keep checklist items under 280 characters.');

  const { data, error } = await getSupabaseClient()
    .from('action_checklist_items')
    .update({ title })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteActionChecklistItem(item: ChecklistItem, userId: string) {
  const client = getSupabaseClient();
  const { error: deleteError } = await client
    .from('action_checklist_items')
    .delete()
    .eq('id', item.id)
    .eq('user_id', userId);
  if (deleteError) throw deleteError;

  const { data: following, error: followingError } = await client
    .from('action_checklist_items')
    .select()
    .eq('action_id', item.action_id)
    .eq('user_id', userId)
    .gt('position', item.position)
    .order('position', { ascending: true });
  if (followingError) throw followingError;
  for (const next of following) {
    const { error } = await client
      .from('action_checklist_items')
      .update({ position: next.position - 1 })
      .eq('id', next.id)
      .eq('user_id', userId);
    if (error) throw error;
  }
}

export async function moveActionChecklistItem(itemId: string, direction: -1 | 1) {
  const { error } = await getSupabaseClient().rpc('move_action_checklist_item', {
    p_direction: direction,
    p_item_id: itemId,
  });
  if (error) throw error;
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
  await ensureChecklistItems(data.id, userId, action.checklistItems);
  return data;
}

/**
 * Store an understood capture according to the confidence gate decision.
 * Idempotent per capture: a retry never creates a second action.
 */
export async function fileUnderstoodAction({
  action,
  captureId,
  decision,
  projectId,
  timezone,
  userId,
}: PendingActionInput & { decision: FilingDecision }) {
  const client = getSupabaseClient();
  const { data: existing, error: existingError } = await client
    .from('actions')
    .select()
    .eq('voice_capture_id', captureId)
    .eq('user_id', userId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    if (!existing.checklist_target_action_id) {
      await ensureChecklistItems(existing.id, userId, action.checklistItems);
    }
    return existing;
  }

  const isChecklistAppend = Boolean(action.checklistTargetActionId && action.checklistItems.length);
  if (isChecklistAppend && decision.outcome === 'auto') {
    return appendActionChecklistItems(
      action.checklistTargetActionId!,
      userId,
      action.checklistItems,
    );
  }

  const autoFiled = decision.outcome === 'auto';
  // Below the low bar nothing of the AI's placement is kept: the user gets the
  // text with a title and decides everything else (Kern: never guess).
  const keepSuggestions = decision.outcome !== 'raw' || isChecklistAppend;
  const { data, error } = await client
    .from('actions')
    .insert({
      action_type: actionTypeForIntent(action.intent),
      auto_filed_at: autoFiled ? new Date().toISOString() : null,
      category: autoFiled ? (action.suggestedCategory ?? 'inbox') : 'inbox',
      checklist_append_items: isChecklistAppend ? action.checklistItems : [],
      checklist_target_action_id: isChecklistAppend ? action.checklistTargetActionId : null,
      clarification_question: action.clarificationQuestion,
      confidence: action.confidence,
      message_draft: action.messageDraft,
      project_id: projectIdForFiling(decision, projectId),
      requires_clarification: action.requiresClarification,
      scheduled_at: action.scheduledAt,
      scheduled_timezone: action.scheduledAt ? timezone : null,
      status: autoFiled ? 'approved' : 'pending',
      suggested_category: keepSuggestions ? action.suggestedCategory : null,
      suggested_project_name: keepSuggestions ? action.suggestedProjectName : null,
      suggested_people: keepSuggestions ? action.people : [],
      summary: action.summary || null,
      title: action.title,
      user_id: userId,
      voice_capture_id: captureId,
    })
    .select()
    .single();
  if (error) throw error;
  if (!isChecklistAppend) await ensureChecklistItems(data.id, userId, action.checklistItems);

  if (autoFiled && decision.contactIds.length) {
    const rows = action.people.flatMap((person, index) => {
      const personId = decision.contactIds[index];
      return personId ? [{ action_id: data.id, person_id: personId, role: person.role }] : [];
    });
    const { error: peopleError } = await client
      .from('action_people')
      .upsert(rows, { onConflict: 'action_id,person_id,role', ignoreDuplicates: true });
    if (peopleError) throw peopleError;
  }
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
    category = action.suggested_category ?? action.category,
    people = suggestedPeopleFrom(action.suggested_people),
    projectName = action.suggested_project_name,
  }: PendingApprovalInput = {},
) {
  const checklistAppendItems = checklistItemsFrom(action.checklist_append_items);
  if (action.checklist_target_action_id && checklistAppendItems.length) {
    const appendedAction = await appendActionChecklistItems(
      action.checklist_target_action_id,
      userId,
      checklistAppendItems,
    );
    const { error } = await getSupabaseClient()
      .from('actions')
      .delete()
      .eq('id', action.id)
      .eq('user_id', userId);
    if (error) throw error;
    return appendedAction;
  }

  // A suggested name only resolves to a project the user already has. Creating one is an
  // explicit choice on the edit screen, never a side effect of approving.
  const normalizedName = projectName?.trim() ? normalizedProjectName(projectName) : null;
  const project = normalizedName
    ? ((await getProjects(userId)).find(
        (candidate) => normalizedProjectName(candidate.name) === normalizedName,
      ) ?? null)
    : null;
  const contacts = await getContacts(userId);
  for (const person of people) {
    const normalizedName = normalizedContactName(person.name);
    let contact = contacts.find(
      (candidate) => normalizedContactName(candidate.name) === normalizedName,
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
    auto_filed_at: null,
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

export async function getActionChecklistItems(actionId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('action_checklist_items')
    .select()
    .eq('action_id', actionId)
    .eq('user_id', userId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data;
}

export async function setActionChecklistItemCompleted(
  itemId: string,
  userId: string,
  isCompleted: boolean,
) {
  const { data, error } = await getSupabaseClient()
    .from('action_checklist_items')
    .update({
      completed_at: isCompleted ? new Date().toISOString() : null,
      is_completed: isCompleted,
    })
    .eq('id', itemId)
    .eq('user_id', userId)
    .select()
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
