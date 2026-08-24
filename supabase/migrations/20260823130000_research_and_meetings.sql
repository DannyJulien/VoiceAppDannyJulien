-- Optional research enrichment with source provenance and owner-scoped meeting briefings.
-- Apply after 20260822130000_phase_1_foundation.sql.

begin;

create type public.research_goal as enum (
  'answer_question',
  'support_claim',
  'challenge_claim',
  'meeting_preparation',
  'decision_support',
  'general_background'
);
create type public.research_freshness as enum ('current', 'recent', 'historical', 'not_time_sensitive');
create type public.research_status as enum ('processing', 'completed', 'failed');
create type public.research_confidence as enum ('high', 'medium', 'low');
create type public.research_source_type as enum (
  'government',
  'statistics',
  'eu_institution',
  'regulation',
  'university',
  'research',
  'news',
  'company',
  'documentation',
  'other'
);

create table public.research_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  voice_capture_id uuid references public.voice_captures (id) on delete set null,
  action_id uuid references public.actions (id) on delete set null,
  topic text not null check (char_length(trim(topic)) between 1 and 280),
  original_query text not null check (char_length(trim(original_query)) between 1 and 12000),
  research_goal public.research_goal,
  research_freshness public.research_freshness not null default 'not_time_sensitive',
  status public.research_status not null default 'processing',
  overall_confidence public.research_confidence,
  direct_answer text,
  executive_summary text,
  share_message text,
  talking_points jsonb not null default '[]'::jsonb,
  counterpoints jsonb not null default '[]'::jsonb,
  researched_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.research_sources (
  id uuid primary key default gen_random_uuid(),
  research_session_id uuid not null references public.research_sessions (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 600),
  publisher text check (publisher is null or char_length(trim(publisher)) between 1 and 280),
  url text not null check (url ~ '^https?://'),
  published_at timestamptz,
  accessed_at timestamptz not null default now(),
  source_type public.research_source_type not null,
  trust_tier smallint not null check (trust_tier between 1 and 5),
  metadata jsonb not null default '{}'::jsonb
);

create table public.research_findings (
  id uuid primary key default gen_random_uuid(),
  research_session_id uuid not null references public.research_sessions (id) on delete cascade,
  claim text not null check (char_length(trim(claim)) between 1 and 2000),
  explanation text,
  confidence public.research_confidence not null,
  created_at timestamptz not null default now()
);

create table public.research_finding_sources (
  research_finding_id uuid not null references public.research_findings (id) on delete cascade,
  research_source_id uuid not null references public.research_sources (id) on delete cascade,
  primary key (research_finding_id, research_source_id)
);

create table public.meeting_contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  research_session_id uuid references public.research_sessions (id) on delete set null,
  action_id uuid references public.actions (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 280),
  meeting_title text check (meeting_title is null or char_length(trim(meeting_title)) between 1 and 280),
  meeting_start timestamptz not null,
  meeting_end timestamptz,
  briefing text not null check (char_length(trim(briefing)) between 1 and 16000),
  talking_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meeting_context_end_after_start check (meeting_end is null or meeting_end >= meeting_start)
);

create index research_sessions_user_created_at_idx on public.research_sessions (user_id, created_at desc);
create index research_sessions_user_topic_idx on public.research_sessions (user_id, lower(topic));
create index research_sources_session_idx on public.research_sources (research_session_id, trust_tier asc);
create index research_findings_session_idx on public.research_findings (research_session_id, created_at asc);
create index research_finding_sources_source_idx on public.research_finding_sources (research_source_id);
create index meeting_contexts_user_meeting_start_idx on public.meeting_contexts (user_id, meeting_start asc);

create trigger meeting_contexts_set_updated_at
before update on public.meeting_contexts
for each row execute procedure public.set_updated_at();

grant select on table public.research_sessions to authenticated;
grant select on table public.research_sources to authenticated;
grant select on table public.research_findings to authenticated;
grant select on table public.research_finding_sources to authenticated;
grant select, insert, update, delete on table public.meeting_contexts to authenticated;

alter table public.research_sessions enable row level security;
alter table public.research_sources enable row level security;
alter table public.research_findings enable row level security;
alter table public.research_finding_sources enable row level security;
alter table public.meeting_contexts enable row level security;

create policy "research_sessions: owners can read"
on public.research_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy "research_sources: session owners can read"
on public.research_sources for select to authenticated
using (
  exists (
    select 1 from public.research_sessions session
    where session.id = research_session_id and session.user_id = (select auth.uid())
  )
);

create policy "research_findings: session owners can read"
on public.research_findings for select to authenticated
using (
  exists (
    select 1 from public.research_sessions session
    where session.id = research_session_id and session.user_id = (select auth.uid())
  )
);

create policy "research_finding_sources: session owners can read"
on public.research_finding_sources for select to authenticated
using (
  exists (
    select 1
    from public.research_findings finding
    join public.research_sessions session on session.id = finding.research_session_id
    where finding.id = research_finding_id and session.user_id = (select auth.uid())
  )
);

create policy "meeting_contexts: owners can read"
on public.meeting_contexts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "meeting_contexts: owners can insert"
on public.meeting_contexts for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    research_session_id is null
    or exists (
      select 1 from public.research_sessions session
      where session.id = research_session_id and session.user_id = (select auth.uid())
    )
  )
  and (
    action_id is null
    or exists (
      select 1 from public.actions action
      where action.id = action_id and action.user_id = (select auth.uid())
    )
  )
);

create policy "meeting_contexts: owners can update"
on public.meeting_contexts for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    research_session_id is null
    or exists (
      select 1 from public.research_sessions session
      where session.id = research_session_id and session.user_id = (select auth.uid())
    )
  )
  and (
    action_id is null
    or exists (
      select 1 from public.actions action
      where action.id = action_id and action.user_id = (select auth.uid())
    )
  )
);

create policy "meeting_contexts: owners can delete"
on public.meeting_contexts for delete to authenticated
using ((select auth.uid()) = user_id);

commit;
