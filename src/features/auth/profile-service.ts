import type { Database } from '@/types/database';

import { getSupabaseClient } from '@/services/supabase/client';

export type SavedProfile = Database['public']['Tables']['profiles']['Row'];

export async function getProfile(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .select()
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  update: Database['public']['Tables']['profiles']['Update'],
) {
  const { data, error } = await getSupabaseClient()
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
