-- A location is optional context for a capture. Existing actions remain valid and untouched.
begin;

alter table public.actions
  add column location text
    check (location is null or char_length(trim(location)) between 1 and 280);

create index actions_user_location_idx
  on public.actions (user_id, location)
  where location is not null;

commit;
