-- Confidence gate (issue #7). A confident, low-risk capture may file itself;
-- everything else still waits in the Inbox. Auto-filed rows are stamped so the
-- app can show its work and let the user send the item back for review.

begin;

alter table public.actions
  add column auto_filed_at timestamptz;

alter table public.profiles
  add column auto_file_captures boolean not null default true;

commit;
