import { getProject } from '@/features/projects/project-service';
import { buildProjectBrief, type ProjectBriefMode } from '@/features/projects/project-brief-utils';
import { getProjectActions } from '@/features/actions/action-service';
import { getSupabaseClient } from '@/services/supabase/client';

export { type ProjectBriefMode } from '@/features/projects/project-brief-utils';

function projectBriefError(error: unknown): Error | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { code?: unknown; message?: unknown };
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  const schemaIsMissing =
    candidate.code === 'PGRST204' ||
    candidate.code === 'PGRST205' ||
    (candidate.code === '42703' && /(archived_at|exported_at)/i.test(message));

  return schemaIsMissing
    ? new Error(
        'Project briefs are being set up. Please try again after the latest update is live.',
      )
    : null;
}

export async function exportProjectBrief({
  mode,
  projectId,
  userId,
}: {
  mode: ProjectBriefMode;
  projectId: string;
  userId: string;
}) {
  const [project, actions] = await Promise.all([
    getProject(projectId, userId),
    getProjectActions(projectId, userId),
  ]);
  const brief = buildProjectBrief({ actions, mode, project });
  const client = getSupabaseClient();
  const { data: savedBrief, error: briefError } = await client
    .from('project_briefs')
    .insert({ content: brief.content, mode, project_id: projectId, user_id: userId })
    .select()
    .single();
  if (briefError) throw projectBriefError(briefError) ?? briefError;

  if (brief.includedActionIds.length) {
    const { error: entriesError } = await client.from('project_brief_entries').insert(
      brief.includedActionIds.map((actionId) => ({
        action_id: actionId,
        brief_id: savedBrief.id,
      })),
    );
    if (entriesError) throw projectBriefError(entriesError) ?? entriesError;
  }

  if (brief.exportedActionIds.length) {
    // Marks what "new only" has already handed over. It never hides a note: the project
    // view and the timeline both keep showing exported entries (#89).
    const shippedAt = new Date().toISOString();
    const { error: archiveError } = await client
      .from('actions')
      .update({ exported_at: shippedAt })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .in('id', brief.exportedActionIds);
    if (archiveError) throw projectBriefError(archiveError) ?? archiveError;
  }

  return brief;
}
