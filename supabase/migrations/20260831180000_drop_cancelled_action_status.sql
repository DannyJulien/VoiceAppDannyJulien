-- Drop the 'cancelled' action status (issue #66).
-- Dismissing a note promised "discarded, not saved" but only set status = 'cancelled',
-- leaving the note visible in the timeline. Dismiss now deletes, so the status goes away.
-- Existing cancelled rows were dismissed by their owner and are removed accordingly.

delete from public.actions where status = 'cancelled';

alter type public.action_status rename to action_status_old;
create type public.action_status as enum ('pending', 'approved', 'completed');

alter table public.actions alter column status drop default;
alter table public.actions
  alter column status type public.action_status
  using status::text::public.action_status;
alter table public.actions alter column status set default 'pending';

drop type public.action_status_old;
