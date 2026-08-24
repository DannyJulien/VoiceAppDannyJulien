-- Phase 1: account, ownership, and persistence foundation.
-- Apply with `supabase db push` after linking this repository to a Supabase project.

begin;

create extension if not exists pgcrypto;

create type public.preferred_language as enum ('en', 'nl', 'fr');
create type public.capture_processing_status as enum ('recorded', 'uploaded', 'transcribed', 'failed');
create type public.action_type as enum ('note', 'task', 'reminder', 'message');
create type public.action_status as enum ('pending', 'approved', 'completed', 'cancelled');
create type public.person_role as enum ('recipient', 'mentioned');
create type public.notification_status as enum ('pending', 'delivered', 'cancelled', 'failed');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null check (char_length(email) <= 255),
  display_name text check (display_name is null or char_length(display_name) between 2 and 80),
  preferred_language public.preferred_language not null default 'en',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.voice_captures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Private path in the `voice-captures` storage bucket. Raw audio is never public.
  audio_path text unique check (
    audio_path is null or split_part(audio_path, '/', 1) = user_id::text
  ),
  transcript text,
  processing_status public.capture_processing_status not null default 'recorded',
  created_at timestamptz not null default now()
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  voice_capture_id uuid references public.voice_captures (id) on delete set null,
  action_type public.action_type not null,
  title text not null check (char_length(trim(title)) between 1 and 280),
  summary text,
  status public.action_status not null default 'pending',
  scheduled_at timestamptz,
  scheduled_timezone text check (scheduled_timezone is null or char_length(scheduled_timezone) <= 64),
  message_draft text,
  confidence numeric(3, 2) check (confidence is null or confidence between 0 and 1),
  requires_clarification boolean not null default false,
  clarification_question text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint message_draft_is_only_for_messages
    check (action_type = 'message' or message_draft is null),
  constraint clarification_has_question
    check (not requires_clarification or clarification_question is not null)
);

create table public.people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  email text check (email is null or char_length(email) <= 255),
  phone text check (phone is null or char_length(phone) <= 48),
  company text check (company is null or char_length(company) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.action_people (
  action_id uuid not null references public.actions (id) on delete cascade,
  person_id uuid not null references public.people (id) on delete cascade,
  role public.person_role not null,
  primary key (action_id, person_id, role)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  action_id uuid references public.actions (id) on delete set null,
  scheduled_for timestamptz not null,
  delivered_at timestamptz,
  status public.notification_status not null default 'pending',
  created_at timestamptz not null default now()
);

create index voice_captures_user_created_at_idx on public.voice_captures (user_id, created_at desc);
create index actions_user_status_scheduled_at_idx
  on public.actions (user_id, status, scheduled_at asc nulls last);
create index actions_voice_capture_id_idx on public.actions (voice_capture_id);
create index people_user_name_idx on public.people (user_id, lower(name));
create index action_people_person_id_idx on public.action_people (person_id);
create index notifications_user_scheduled_for_idx
  on public.notifications (user_id, status, scheduled_for asc);

-- Tables created through raw SQL need explicit API role privileges as well as RLS policies.
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.voice_captures to authenticated;
grant select, insert, update, delete on table public.actions to authenticated;
grant select, insert, update, delete on table public.people to authenticated;
grant select, insert, update, delete on table public.action_people to authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger actions_set_updated_at
before update on public.actions
for each row execute procedure public.set_updated_at();

create trigger people_set_updated_at
before update on public.people
for each row execute procedure public.set_updated_at();

-- The client never inserts its own profile. This trigger creates it from a verified Auth event.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.voice_captures enable row level security;
alter table public.actions enable row level security;
alter table public.people enable row level security;
alter table public.action_people enable row level security;
alter table public.notifications enable row level security;

create policy "profiles: owners can read"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create policy "profiles: owners can update"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "voice_captures: owners can read"
on public.voice_captures for select to authenticated
using ((select auth.uid()) = user_id);

create policy "voice_captures: owners can insert"
on public.voice_captures for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "voice_captures: owners can update"
on public.voice_captures for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "voice_captures: owners can delete"
on public.voice_captures for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "actions: owners can read"
on public.actions for select to authenticated
using ((select auth.uid()) = user_id);

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
);

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
);

create policy "actions: owners can delete"
on public.actions for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "people: owners can read"
on public.people for select to authenticated
using ((select auth.uid()) = user_id);

create policy "people: owners can insert"
on public.people for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "people: owners can update"
on public.people for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "people: owners can delete"
on public.people for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "action_people: owner can read"
on public.action_people for select to authenticated
using (
  exists (
    select 1 from public.actions
    where actions.id = action_people.action_id
      and actions.user_id = (select auth.uid())
  )
);

create policy "action_people: owner can insert"
on public.action_people for insert to authenticated
with check (
  exists (
    select 1 from public.actions
    where actions.id = action_people.action_id
      and actions.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.people
    where people.id = action_people.person_id
      and people.user_id = (select auth.uid())
  )
);

create policy "action_people: owner can update"
on public.action_people for update to authenticated
using (
  exists (
    select 1 from public.actions
    where actions.id = action_people.action_id
      and actions.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.actions
    where actions.id = action_people.action_id
      and actions.user_id = (select auth.uid())
  )
  and exists (
    select 1 from public.people
    where people.id = action_people.person_id
      and people.user_id = (select auth.uid())
  )
);

create policy "action_people: owner can delete"
on public.action_people for delete to authenticated
using (
  exists (
    select 1 from public.actions
    where actions.id = action_people.action_id
      and actions.user_id = (select auth.uid())
  )
);

create policy "notifications: owners can read"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "notifications: owners can insert"
on public.notifications for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and (
    action_id is null
    or exists (
      select 1 from public.actions
      where actions.id = notifications.action_id
        and actions.user_id = (select auth.uid())
    )
  )
);

create policy "notifications: owners can update"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and (
    action_id is null
    or exists (
      select 1 from public.actions
      where actions.id = notifications.action_id
        and actions.user_id = (select auth.uid())
    )
  )
);

create policy "notifications: owners can delete"
on public.notifications for delete to authenticated
using ((select auth.uid()) = user_id);

-- Audio remains private and is scoped to a user-id prefix: <auth.uid()>/<capture-id>.m4a
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'voice-captures',
  'voice-captures',
  false,
  26214400,
  array['audio/m4a', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/ogg']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "voice-captures storage: owners can read"
on storage.objects for select to authenticated
using (
  bucket_id = 'voice-captures'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "voice-captures storage: owners can upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'voice-captures'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "voice-captures storage: owners can replace"
on storage.objects for update to authenticated
using (
  bucket_id = 'voice-captures'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'voice-captures'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "voice-captures storage: owners can delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'voice-captures'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

commit;
