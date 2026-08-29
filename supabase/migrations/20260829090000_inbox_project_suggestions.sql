-- Every processed voice capture gets a durable Inbox entry. The AI may propose
-- where it belongs, but it never files the item without the user's approval.

begin;

alter table public.actions
  add column suggested_category public.action_category,
  add column suggested_project_name text
    check (
      suggested_project_name is null
      or char_length(trim(suggested_project_name)) between 1 and 80
    ),
  add column suggested_people jsonb not null default '[]'::jsonb
    check (jsonb_typeof(suggested_people) = 'array');

create index actions_user_status_created_at_idx
  on public.actions (user_id, status, created_at desc);

commit;
