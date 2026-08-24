export type ContextRelevanceCandidate = {
  meetingContextId: string;
  meetingTitle: string;
  meetingStart: string;
};

export type ContextRelevanceSuggestion = {
  confidence: 'high' | 'medium' | 'low';
  researchSessionId: string;
  meeting: ContextRelevanceCandidate;
  reason: string;
};

export interface ContextRelevanceService {
  suggestRelevantMeetings(researchSessionId: string): Promise<ContextRelevanceSuggestion[]>;
}
