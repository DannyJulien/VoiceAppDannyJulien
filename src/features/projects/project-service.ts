import type { Database } from '@/types/database';

import { getSupabaseClient } from '@/services/supabase/client';

export type SavedProject = Database['public']['Tables']['projects']['Row'];

export async function getProjects(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createProject(userId: string, name: string, color: string) {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .insert({ color, name: name.trim(), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getProject(projectId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select()
    .eq('id', projectId)
    .eq('user_id', userId)
    .single();
  if (error) throw error;
  return data;
}
