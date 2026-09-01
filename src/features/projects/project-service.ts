import type { Database } from '@/types/database';

import { getSupabaseClient } from '@/services/supabase/client';
import {
  maxProjectSummaryLength,
  isMissingProjectSummaryColumn,
  normalizedProjectName,
  normalizedProjectSummary,
  projectColors,
} from '@/features/projects/project-utils';

export type SavedProject = Database['public']['Tables']['projects']['Row'];

function withDefaultProjectSummary(project: SavedProject): SavedProject {
  // The project-summary migration can lag a web deployment briefly. Keep older
  // rows usable while the server is catching up, rather than blocking projects.
  return { ...project, summary: project.summary ?? '' };
}

export async function getProjects(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('projects')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map(withDefaultProjectSummary);
}

export async function createProject(userId: string, name: string, color: string, summary = '') {
  const normalizedSummary = normalizedProjectSummary(summary);
  if (normalizedSummary.length > maxProjectSummaryLength) {
    throw new Error(`Keep the project summary under ${maxProjectSummaryLength} characters.`);
  }

  const client = getSupabaseClient();
  const { data, error } = await client
    .from('projects')
    .insert({ color, name: name.trim(), summary: normalizedSummary, user_id: userId })
    .select()
    .single();
  if (!error) return withDefaultProjectSummary(data);

  // A newly deployed web build can reach Supabase before its matching SQL
  // migration is applied. Creating a project must remain available in that
  // window; the optional context will become editable once the migration lands.
  if (!isMissingProjectSummaryColumn(error)) throw error;

  const legacyResult = await client
    .from('projects')
    .insert({ color, name: name.trim(), user_id: userId })
    .select()
    .single();
  if (legacyResult.error) throw legacyResult.error;
  return withDefaultProjectSummary(legacyResult.data);
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
  return withDefaultProjectSummary(data);
}

export async function updateProjectSummary(projectId: string, userId: string, summary: string) {
  const normalizedSummary = normalizedProjectSummary(summary);
  if (normalizedSummary.length > maxProjectSummaryLength) {
    throw new Error(`Keep the project summary under ${maxProjectSummaryLength} characters.`);
  }

  const { data, error } = await getSupabaseClient()
    .from('projects')
    .update({ summary: normalizedSummary })
    .eq('id', projectId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) {
    if (isMissingProjectSummaryColumn(error)) {
      throw new Error('Project context will be available as soon as the latest update is live.');
    }
    throw error;
  }
  return withDefaultProjectSummary(data);
}

/**
 * Removes the project only. Its notes stay in the timeline without a project:
 * `actions.project_id` is `on delete set null`, so the database unlinks them.
 * Brief history for the project cascades away with it.
 */
export async function deleteProject(projectId: string, userId: string) {
  const { error } = await getSupabaseClient()
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId);
  if (error) throw error;
}
