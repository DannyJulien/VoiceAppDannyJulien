import type { Database } from '@/types/database';

import { getSupabaseClient } from '@/services/supabase/client';
import { normalizedProjectName, projectColors } from '@/features/projects/project-utils';

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

export async function findOrCreateProject(userId: string, name: string) {
  const normalizedName = normalizedProjectName(name);
  if (!normalizedName) return null;

  const projects = await getProjects(userId);
  const existing = projects.find(
    (project) => normalizedProjectName(project.name) === normalizedName,
  );
  if (existing) return existing;

  try {
    return await createProject(userId, name, projectColors[0]);
  } catch (error) {
    // A second device may have created this project while the first was approving.
    const refreshedProjects = await getProjects(userId);
    const createdElsewhere = refreshedProjects.find(
      (project) => normalizedProjectName(project.name) === normalizedName,
    );
    if (createdElsewhere) return createdElsewhere;
    throw error;
  }
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
