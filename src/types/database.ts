export type PreferredLanguage = 'en' | 'nl' | 'fr';
export type ActionType = 'note' | 'task' | 'reminder' | 'message';
export type ActionStatus = 'pending' | 'approved' | 'completed' | 'cancelled';
export type ActionCategory = 'inbox' | 'work' | 'personal' | 'meeting' | 'idea';
export type ResearchGoal =
  | 'answer_question'
  | 'support_claim'
  | 'challenge_claim'
  | 'meeting_preparation'
  | 'decision_support'
  | 'general_background';
export type ResearchFreshness = 'current' | 'recent' | 'historical' | 'not_time_sensitive';
export type ResearchStatus = 'processing' | 'completed' | 'failed';
export type ResearchConfidence = 'high' | 'medium' | 'low';
export type ResearchSourceType =
  | 'government'
  | 'statistics'
  | 'eu_institution'
  | 'regulation'
  | 'university'
  | 'research'
  | 'news'
  | 'company'
  | 'documentation'
  | 'other';
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          preferred_language: PreferredLanguage;
          auto_file_captures: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          display_name?: string | null;
          preferred_language?: PreferredLanguage;
          auto_file_captures?: boolean;
        };
        Update: {
          display_name?: string | null;
          preferred_language?: PreferredLanguage;
          auto_file_captures?: boolean;
        };
        Relationships: [];
      };
      voice_captures: {
        Row: {
          id: string;
          user_id: string;
          audio_path: string | null;
          transcript: string | null;
          processing_status: 'recorded' | 'uploaded' | 'transcribed' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          audio_path?: string | null;
          transcript?: string | null;
          processing_status?: 'recorded' | 'uploaded' | 'transcribed' | 'failed';
        };
        Update: {
          audio_path?: string | null;
          transcript?: string | null;
          processing_status?: 'recorded' | 'uploaded' | 'transcribed' | 'failed';
        };
        Relationships: [];
      };
      actions: {
        Row: {
          id: string;
          user_id: string;
          voice_capture_id: string | null;
          action_type: ActionType;
          title: string;
          summary: string | null;
          status: ActionStatus;
          scheduled_at: string | null;
          scheduled_timezone: string | null;
          message_draft: string | null;
          confidence: number | null;
          requires_clarification: boolean;
          clarification_question: string | null;
          project_id: string | null;
          category: ActionCategory;
          suggested_category: ActionCategory | null;
          suggested_project_name: string | null;
          suggested_people: Json;
          auto_filed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          voice_capture_id?: string | null;
          action_type: ActionType;
          title: string;
          summary?: string | null;
          status?: ActionStatus;
          scheduled_at?: string | null;
          scheduled_timezone?: string | null;
          message_draft?: string | null;
          confidence?: number | null;
          requires_clarification?: boolean;
          clarification_question?: string | null;
          project_id?: string | null;
          category?: ActionCategory;
          suggested_category?: ActionCategory | null;
          suggested_project_name?: string | null;
          suggested_people?: Json;
          auto_filed_at?: string | null;
        };
        Update: {
          voice_capture_id?: string | null;
          title?: string;
          summary?: string | null;
          status?: ActionStatus;
          scheduled_at?: string | null;
          scheduled_timezone?: string | null;
          message_draft?: string | null;
          confidence?: number | null;
          requires_clarification?: boolean;
          clarification_question?: string | null;
          project_id?: string | null;
          category?: ActionCategory;
          suggested_category?: ActionCategory | null;
          suggested_project_name?: string | null;
          suggested_people?: Json;
          auto_filed_at?: string | null;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          summary: string;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          summary?: string;
          color?: string;
        };
        Update: {
          name?: string;
          summary?: string;
          color?: string;
        };
        Relationships: [];
      };
      people: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          email: string | null;
          phone: string | null;
          company: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
        };
        Update: {
          name?: string;
          email?: string | null;
          phone?: string | null;
          company?: string | null;
        };
        Relationships: [];
      };
      action_people: {
        Row: { action_id: string; person_id: string; role: 'recipient' | 'mentioned' };
        Insert: { action_id: string; person_id: string; role: 'recipient' | 'mentioned' };
        Update: { role?: 'recipient' | 'mentioned' };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          action_id: string | null;
          scheduled_for: string;
          delivered_at: string | null;
          status: 'pending' | 'delivered' | 'cancelled' | 'failed';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          action_id?: string | null;
          scheduled_for: string;
          delivered_at?: string | null;
          status?: 'pending' | 'delivered' | 'cancelled' | 'failed';
        };
        Update: {
          scheduled_for?: string;
          delivered_at?: string | null;
          status?: 'pending' | 'delivered' | 'cancelled' | 'failed';
        };
        Relationships: [];
      };
      research_sessions: {
        Row: {
          id: string;
          user_id: string;
          voice_capture_id: string | null;
          action_id: string | null;
          topic: string;
          original_query: string;
          research_goal: ResearchGoal | null;
          research_freshness: ResearchFreshness;
          status: ResearchStatus;
          overall_confidence: ResearchConfidence | null;
          direct_answer: string | null;
          executive_summary: string | null;
          share_message: string | null;
          talking_points: Json;
          counterpoints: Json;
          researched_at: string | null;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          voice_capture_id?: string | null;
          action_id?: string | null;
          topic: string;
          original_query: string;
          research_goal?: ResearchGoal | null;
          research_freshness?: ResearchFreshness;
          status?: ResearchStatus;
          overall_confidence?: ResearchConfidence | null;
          direct_answer?: string | null;
          executive_summary?: string | null;
          share_message?: string | null;
          talking_points?: Json;
          counterpoints?: Json;
          researched_at?: string | null;
          completed_at?: string | null;
        };
        Update: {
          action_id?: string | null;
          status?: ResearchStatus;
          overall_confidence?: ResearchConfidence | null;
          direct_answer?: string | null;
          executive_summary?: string | null;
          share_message?: string | null;
          talking_points?: Json;
          counterpoints?: Json;
          researched_at?: string | null;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      research_sources: {
        Row: {
          id: string;
          research_session_id: string;
          title: string;
          publisher: string | null;
          url: string;
          published_at: string | null;
          accessed_at: string;
          source_type: ResearchSourceType;
          trust_tier: number;
          metadata: Json;
        };
        Insert: {
          id?: string;
          research_session_id: string;
          title: string;
          publisher?: string | null;
          url: string;
          published_at?: string | null;
          accessed_at?: string;
          source_type: ResearchSourceType;
          trust_tier: number;
          metadata?: Json;
        };
        Update: {
          title?: string;
          publisher?: string | null;
          published_at?: string | null;
          source_type?: ResearchSourceType;
          trust_tier?: number;
          metadata?: Json;
        };
        Relationships: [];
      };
      research_findings: {
        Row: {
          id: string;
          research_session_id: string;
          claim: string;
          explanation: string | null;
          confidence: ResearchConfidence;
          created_at: string;
        };
        Insert: {
          id?: string;
          research_session_id: string;
          claim: string;
          explanation?: string | null;
          confidence: ResearchConfidence;
        };
        Update: {
          claim?: string;
          explanation?: string | null;
          confidence?: ResearchConfidence;
        };
        Relationships: [];
      };
      research_finding_sources: {
        Row: { research_finding_id: string; research_source_id: string };
        Insert: { research_finding_id: string; research_source_id: string };
        Update: Record<string, never>;
        Relationships: [];
      };
      meeting_contexts: {
        Row: {
          id: string;
          user_id: string;
          research_session_id: string | null;
          action_id: string | null;
          title: string;
          meeting_title: string | null;
          meeting_start: string;
          meeting_end: string | null;
          briefing: string;
          talking_points: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          research_session_id?: string | null;
          action_id?: string | null;
          title: string;
          meeting_title?: string | null;
          meeting_start: string;
          meeting_end?: string | null;
          briefing: string;
          talking_points?: Json;
        };
        Update: {
          research_session_id?: string | null;
          action_id?: string | null;
          title?: string;
          meeting_title?: string | null;
          meeting_start?: string;
          meeting_end?: string | null;
          briefing?: string;
          talking_points?: Json;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      preferred_language: PreferredLanguage;
      action_type: ActionType;
      action_status: ActionStatus;
      action_category: ActionCategory;
      research_goal: ResearchGoal;
      research_freshness: ResearchFreshness;
      research_status: ResearchStatus;
      research_confidence: ResearchConfidence;
    };
    CompositeTypes: Record<string, never>;
  };
};
