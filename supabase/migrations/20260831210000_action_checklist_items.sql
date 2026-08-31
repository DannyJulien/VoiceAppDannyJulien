begin;

create table public.action_checklist_items (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  position integer not null check (position between 0 and 29),
  title text not null check (char_length(trim(title)) between 1 and 280),
  is_completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint action_checklist_items_action_position_key unique (action_id, position),
  constraint action_checklist_items_completion_is_consistent
    check (
      (is_completed and completed_at is not null)
      or (not is_completed and completed_at is null)
    )
);

create index action_checklist_items_action_position_idx
  on public.action_checklist_items (action_id, position);

grant select, insert, update, delete on table public.action_checklist_items to authenticated;

alter table public.action_checklist_items enable row level security;

create policy "action checklist items: owners can read"
on public.action_checklist_items for select to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.actions
    where actions.id = action_checklist_items.action_id
      and actions.user_id = (select auth.uid())
  )
);

create policy "action checklist items: owners can insert"
on public.action_checklist_items for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.actions
    where actions.id = action_checklist_items.action_id
      and actions.user_id = (select auth.uid())
  )
);

create policy "action checklist items: owners can update"
on public.action_checklist_items for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.actions
    where actions.id = action_checklist_items.action_id
      and actions.user_id = (select auth.uid())
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.actions
    where actions.id = action_checklist_items.action_id
      and actions.user_id = (select auth.uid())
  )
);

create policy "action checklist items: owners can delete"
on public.action_checklist_items for delete to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.actions
    where actions.id = action_checklist_items.action_id
      and actions.user_id = (select auth.uid())
  )
);

commit;
