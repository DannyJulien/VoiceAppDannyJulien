-- A concise project summary gives the user and the filing assistant stable context.
-- Existing projects receive an empty summary and remain fully usable.

begin;

alter table public.projects
  add column summary text not null default ''
    check (char_length(summary) <= 500);

commit;
