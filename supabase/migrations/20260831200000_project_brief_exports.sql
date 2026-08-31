-- Project briefs preserve exactly what was handed to a fresh Claude Code session.
-- Notes and ideas included in a brief are marked as shipped and leave the active timeline;
-- unfinished tasks remain available for every future brief until they are completed.

begin;

create type public.project_brief_mode as enum ('full', 'new_only');

alter table public.actions
  add column exported_at timestamptz,
  add column archived_at timestamptz;

create index actions_user_project_unshipped_idx
  on public.actions (user_id, project_id, created_at desc)
  where exported_at is null;

create table public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  mode public.project_brief_mode not null,
  content text not null check (char_length(content) > 0),
  created_at timestamptz not null default now()
);

create table public.project_brief_entries (
  brief_id uuid not null references public.project_briefs (id) on delete cascade,
  action_id uuid not null references public.actions (id) on delete cascade,
  primary key (brief_id, action_id)
);

create index project_briefs_project_created_at_idx
  on public.project_briefs (project_id, created_at desc);
create index project_brief_entries_action_idx
  on public.project_brief_entries (action_id);

grant select, insert on table public.project_briefs to authenticated;
grant select, insert on table public.project_brief_entries to authenticated;

alter table public.project_briefs enable row level security;
alter table public.project_brief_entries enable row level security;

create policy "project briefs: owners can read"
on public.project_briefs for select to authenticated
using ((select auth.uid()) = user_id);

create policy "project briefs: owners can insert"
on public.project_briefs for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.projects
    where projects.id = project_briefs.project_id
      and projects.user_id = (select auth.uid())
  )
);

create policy "project brief entries: owners can read"
on public.project_brief_entries for select to authenticated
using (
  exists (
    select 1 from public.project_briefs
    where project_briefs.id = project_brief_entries.brief_id
      and project_briefs.user_id = (select auth.uid())
  )
);

create policy "project brief entries: owners can insert"
on public.project_brief_entries for insert to authenticated
with check (
  exists (
    select 1
    from public.project_briefs
    join public.actions on actions.id = project_brief_entries.action_id
    where project_briefs.id = project_brief_entries.brief_id
      and project_briefs.project_id = actions.project_id
      and project_briefs.user_id = (select auth.uid())
      and actions.user_id = (select auth.uid())
  )
);

commit;
