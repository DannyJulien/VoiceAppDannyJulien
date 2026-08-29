import type { Database } from '@/types/database';

import { getSupabaseClient } from '@/services/supabase/client';

export type SavedContact = Database['public']['Tables']['people']['Row'];
export type ContactInput = Pick<
  Database['public']['Tables']['people']['Insert'],
  'company' | 'email' | 'name' | 'phone'
>;

export async function getContacts(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select()
    .eq('user_id', userId)
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function getContact(contactId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .select()
    .eq('id', contactId)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function getContactTimeline(contactId: string, userId: string) {
  const client = getSupabaseClient();
  const { data: links, error: linksError } = await client
    .from('action_people')
    .select('action_id')
    .eq('person_id', contactId);
  if (linksError) throw linksError;
  if (!links.length) return [];

  const { data, error } = await client
    .from('actions')
    .select()
    .eq('user_id', userId)
    .in(
      'id',
      links.map((link) => link.action_id),
    )
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createContact(userId: string, input: ContactInput) {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .insert({
      company: input.company?.trim() || null,
      email: input.email?.trim() || null,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateContact(contactId: string, userId: string, input: ContactInput) {
  const { data, error } = await getSupabaseClient()
    .from('people')
    .update({
      company: input.company?.trim() || null,
      email: input.email?.trim() || null,
      name: input.name.trim(),
      phone: input.phone?.trim() || null,
    })
    .eq('id', contactId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Removes the person. Their links to notes cascade away; the notes themselves stay. */
export async function deleteContact(contactId: string, userId: string) {
  const { error } = await getSupabaseClient()
    .from('people')
    .delete()
    .eq('id', contactId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function getActionRecipients(actionId: string, userId: string) {
  const client = getSupabaseClient();
  const { data: links, error: linkError } = await client
    .from('action_people')
    .select('person_id')
    .eq('action_id', actionId)
    .eq('role', 'recipient');
  if (linkError) throw linkError;
  if (links.length === 0) return [];

  const { data, error } = await client
    .from('people')
    .select()
    .eq('user_id', userId)
    .in(
      'id',
      links.map((link) => link.person_id),
    )
    .order('name', { ascending: true });
  if (error) throw error;
  return data;
}

export async function addActionRecipient(actionId: string, personId: string) {
  const { error } = await getSupabaseClient()
    .from('action_people')
    .upsert(
      { action_id: actionId, person_id: personId, role: 'recipient' },
      { onConflict: 'action_id,person_id,role', ignoreDuplicates: true },
    );
  if (error) throw error;
}
