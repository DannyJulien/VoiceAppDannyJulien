import type { ResearchResult } from '@/features/research/research-schema';
import { getSupabaseClient } from '@/services/supabase/client';

import { createMeetingBriefing } from './meeting-utils';

export async function createMeetingContext({
  meetingStart,
  meetingTitle,
  result,
  userId,
}: {
  meetingStart: string;
  meetingTitle: string;
  result: ResearchResult;
  userId: string;
}) {
  const briefing = createMeetingBriefing(result);
  const { data, error } = await getSupabaseClient()
    .from('meeting_contexts')
    .insert({
      briefing,
      meeting_start: meetingStart,
      meeting_title: meetingTitle.trim() || null,
      research_session_id: result.id,
      talking_points: result.talkingPoints,
      title: meetingTitle.trim() || `Briefing: ${result.topic}`,
      user_id: userId,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
