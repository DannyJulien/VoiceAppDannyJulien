import { FunctionsHttpError } from '@supabase/supabase-js';

import type { ResearchFreshness, ResearchGoal } from '@/features/actions/action-schema';
import {
  researchResultSchema,
  startResearchResponseSchema,
  type ResearchResult,
} from '@/features/research/research-schema';
import { getSupabaseClient } from '@/services/supabase/client';
import type { Database } from '@/types/database';

export type StartResearchInput = {
  actionId?: string | null;
  captureId?: string | null;
  researchFreshness?: ResearchFreshness;
  researchGoal?: ResearchGoal | null;
  topic: string;
};

async function captureForResearch(actionId: string | null, captureId: string | null) {
  if (captureId) return captureId;
  if (!actionId) throw new Error('This note needs to be saved before it can be researched.');

  const client = getSupabaseClient();
  const { data: action, error: actionError } = await client
    .from('actions')
    .select('id, title, summary')
    .eq('id', actionId)
    .single();
  if (actionError || !action) throw actionError ?? new Error('This note is unavailable.');

  const transcript = [action.title, action.summary].filter(Boolean).join('\n\n').trim();
  if (!transcript) throw new Error('Add a title or details before starting research.');

  const { data: capture, error: captureError } = await client
    .from('voice_captures')
    .insert({ processing_status: 'transcribed', transcript })
    .select('id')
    .single();
  if (captureError || !capture) {
    throw captureError ?? new Error('Unable to prepare this note for research.');
  }

  const { error: linkError } = await client
    .from('actions')
    .update({ voice_capture_id: capture.id })
    .eq('id', action.id);
  if (linkError) throw linkError;
  return capture.id;
}

async function messageForResearchError(error: unknown) {
  if (error instanceof FunctionsHttpError) {
    const payload = (await error.context.json().catch(() => null)) as { error?: unknown } | null;
    if (typeof payload?.error === 'string') return payload.error;
  }

  return error instanceof Error ? error.message : 'Unable to start research.';
}

export async function startResearch({
  actionId = null,
  captureId = null,
  researchFreshness = 'not_time_sensitive',
  researchGoal = 'general_background',
  topic,
}: StartResearchInput) {
  const resolvedCaptureId = await captureForResearch(actionId, captureId);
  const { data, error } = await getSupabaseClient().functions.invoke('research', {
    body: {
      actionId,
      captureId: resolvedCaptureId,
      researchFreshness,
      researchGoal,
      topic: topic.trim(),
    },
  });

  if (error) throw new Error(await messageForResearchError(error));
  return startResearchResponseSchema.parse(data);
}

export async function getResearchResult(
  researchSessionId: string,
  userId: string,
): Promise<ResearchResult> {
  const client = getSupabaseClient();
  const { data: session, error: sessionError } = await client
    .from('research_sessions')
    .select()
    .eq('id', researchSessionId)
    .eq('user_id', userId)
    .single();
  if (sessionError) throw sessionError;
  if (
    session.status !== 'completed' ||
    !session.direct_answer ||
    !session.executive_summary ||
    !session.share_message ||
    !session.overall_confidence ||
    !session.researched_at
  ) {
    throw new Error('This research result is not ready yet.');
  }

  const { data: sources, error: sourceError } = await client
    .from('research_sources')
    .select()
    .eq('research_session_id', researchSessionId)
    .order('trust_tier', { ascending: true });
  if (sourceError) throw sourceError;

  const { data: findings, error: findingError } = await client
    .from('research_findings')
    .select()
    .eq('research_session_id', researchSessionId)
    .order('created_at', { ascending: true });
  if (findingError) throw findingError;

  const findingIds = findings.map((finding) => finding.id);
  const { data: findingSources, error: linkError } = findingIds.length
    ? await client.from('research_finding_sources').select().in('research_finding_id', findingIds)
    : { data: [], error: null };
  if (linkError) throw linkError;

  const sourceIdsByFinding = new Map<string, string[]>();
  findingSources.forEach((link) => {
    sourceIdsByFinding.set(link.research_finding_id, [
      ...(sourceIdsByFinding.get(link.research_finding_id) ?? []),
      link.research_source_id,
    ]);
  });

  return researchResultSchema.parse({
    id: session.id,
    topic: session.topic,
    directAnswer: session.direct_answer,
    executiveSummary: session.executive_summary,
    shareMessage: session.share_message,
    talkingPoints: session.talking_points,
    counterpoints: session.counterpoints,
    overallConfidence: session.overall_confidence,
    researchedAt: session.researched_at,
    keyFindings: findings.map((finding) => ({
      id: finding.id,
      claim: finding.claim,
      explanation: finding.explanation,
      confidence: finding.confidence,
      sourceIds: sourceIdsByFinding.get(finding.id) ?? [],
    })),
    sources: sources.map((source) => ({
      id: source.id,
      title: source.title,
      publisher: source.publisher,
      url: source.url,
      publishedAt: source.published_at,
      accessedAt: source.accessed_at,
      sourceType: source.source_type,
      trustTier: source.trust_tier,
    })),
  });
}

export async function getResearchSessions(userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('research_sessions')
    .select()
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getResearchSessionsForAction(actionId: string, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('research_sessions')
    .select()
    .eq('action_id', actionId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createTaskFromResearch(result: ResearchResult, userId: string) {
  const { data, error } = await getSupabaseClient()
    .from('actions')
    .insert({
      action_type: 'task',
      status: 'approved',
      summary: result.executiveSummary,
      title: `Use research: ${result.topic}`,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type MeetingContextInsert = Pick<
  Database['public']['Tables']['meeting_contexts']['Insert'],
  | 'briefing'
  | 'meeting_start'
  | 'meeting_title'
  | 'research_session_id'
  | 'talking_points'
  | 'title'
>;
