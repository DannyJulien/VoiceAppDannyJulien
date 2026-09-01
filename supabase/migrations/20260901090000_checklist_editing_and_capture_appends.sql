-- Checklists remain owner-scoped. A capture that proposes an addition keeps the
-- target and items on its pending action until the user approves it.

begin;

alter table public.actions
  add column checklist_target_action_id uuid references public.actions (id) on delete set null,
  add column checklist_append_items jsonb not null default '[]'::jsonb,
  add constraint actions_checklist_append_items_is_array
    check (jsonb_typeof(checklist_append_items) = 'array');

create index actions_user_checklist_target_idx
  on public.actions (user_id, checklist_target_action_id)
  where checklist_target_action_id is not null;

create function public.validate_checklist_target_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.checklist_target_action_id is not null and not exists (
    select 1
    from public.actions as target
    where target.id = new.checklist_target_action_id
      and target.user_id = new.user_id
  ) then
    raise exception 'checklist target must belong to the same user';
  end if;
  return new;
end;
$$;

create trigger actions_validate_checklist_target_owner
before insert or update of checklist_target_action_id, user_id on public.actions
for each row execute procedure public.validate_checklist_target_owner();

revoke all on function public.validate_checklist_target_owner() from public, anon, authenticated;

alter table public.action_checklist_items
  drop constraint action_checklist_items_action_position_key,
  add constraint action_checklist_items_action_position_key
    unique (action_id, position) deferrable initially immediate;

create function public.move_action_checklist_item(p_item_id uuid, p_direction integer)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_item public.action_checklist_items%rowtype;
  adjacent_item public.action_checklist_items%rowtype;
begin
  if p_direction not in (-1, 1) then
    raise exception 'checklist direction must be -1 or 1';
  end if;

  select * into current_item
  from public.action_checklist_items
  where id = p_item_id
    and user_id = (select auth.uid());
  if not found then
    raise exception 'checklist item not found';
  end if;

  select * into adjacent_item
  from public.action_checklist_items
  where action_id = current_item.action_id
    and user_id = (select auth.uid())
    and position = current_item.position + p_direction;
  if not found then
    return;
  end if;

  set constraints action_checklist_items_action_position_key deferred;
  update public.action_checklist_items
  set position = case
    when id = current_item.id then adjacent_item.position
    when id = adjacent_item.id then current_item.position
    else position
  end
  where id in (current_item.id, adjacent_item.id)
    and user_id = (select auth.uid());
end;
$$;

grant execute on function public.move_action_checklist_item(uuid, integer) to authenticated;

commit;
