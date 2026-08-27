-- Projects turn the existing action list into a clear, personal timeline.
-- Existing actions stay available and are placed in the neutral inbox category.

begin;

create type public.action_category as enum ('inbox', 'work', 'personal', 'meeting', 'idea');

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  color text not null default '#4F46E5' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index projects_user_name_unique_idx on public.projects (user_id, lower(name));
create index projects_user_created_at_idx on public.projects (user_id, created_at desc);

alter table public.actions
  add column project_id uuid references public.projects (id) on delete set null,
  add column category public.action_category not null default 'inbox';

create index actions_user_project_created_at_idx
  on public.actions (user_id, project_id, created_at desc);
create index actions_user_category_created_at_idx
  on public.actions (user_id, category, created_at desc);

grant select, insert, update, delete on table public.projects to authenticated;

create trigger projects_set_updated_at
before update on public.projects
for each row execute procedure public.set_updated_at();

alter table public.projects enable row level security;

create policy "projects: owners can read"
on public.projects for select to authenticated
using ((select auth.uid()) = user_id);

create policy "projects: owners can insert"
on public.projects for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "projects: owners can update"
on public.projects for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "projects: owners can delete"
on public.projects for delete to authenticated
using ((select auth.uid()) = user_id);

drop policy "actions: owners can insert" on public.actions;
create policy "actions: owners can insert"
on public.actions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    voice_capture_id is null
    or exists (
      select 1 from public.voice_captures
      where voice_captures.id = actions.voice_capture_id
        and voice_captures.user_id = (select auth.uid())
    )
  )
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = actions.project_id
        and projects.user_id = (select auth.uid())
    )
  )
);

drop policy "actions: owners can update" on public.actions;
create policy "actions: owners can update"
on public.actions for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    voice_capture_id is null
    or exists (
      select 1 from public.voice_captures
      where voice_captures.id = actions.voice_capture_id
        and voice_captures.user_id = (select auth.uid())
    )
  )
  and (
    project_id is null
    or exists (
      select 1 from public.projects
      where projects.id = actions.project_id
        and projects.user_id = (select auth.uid())
    )
  )
);

commit;
