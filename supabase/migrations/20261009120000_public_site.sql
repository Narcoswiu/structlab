-- Публична част: чакащ списък, контактна форма, демо глава, защита от спам.
--
-- И трите таблици се пишат само от сървъра (secret key) – формите са публични
-- и нямат влязъл потребител. Чете ги само admin.

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  university text not null check (char_length(university) between 1 and 160),
  specialty text not null check (char_length(specialty) between 1 and 160),
  year integer not null check (year between 1 and 6),
  -- кога е дадено съгласието с Политиката за поверителност
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  -- попълва се, когато admin изпрати покана
  invited_at timestamptz
);
create unique index waitlist_email_idx on public.waitlist (email);
create index waitlist_created_idx on public.waitlist (created_at desc);

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);
create index contact_messages_created_idx on public.contact_messages (created_at desc);

-- Брояч за ограничаване на публичните форми. Пази се само хеш на IP адреса
-- (с таен ключ), никога самият адрес; записите се трият след 24 часа.
create table public.request_throttle (
  id bigint generated always as identity primary key,
  kind text not null check (kind ~ '^[a-z-]{1,40}$'),
  key_hash text not null check (key_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index request_throttle_lookup_idx
  on public.request_throttle (kind, key_hash, created_at desc);
create index request_throttle_created_idx on public.request_throttle (created_at);

-- Една глава може да е отбелязана като публично демо.
alter table public.chapters add column is_demo boolean not null default false;

revoke all on public.waitlist, public.contact_messages, public.request_throttle
  from anon, authenticated;
grant select, insert, update, delete
  on public.waitlist, public.contact_messages, public.request_throttle
  to service_role;
grant select on public.waitlist, public.contact_messages to authenticated;
grant update (invited_at) on public.waitlist to authenticated;
grant update (handled_at) on public.contact_messages to authenticated;

alter table public.waitlist enable row level security;
alter table public.contact_messages enable row level security;
alter table public.request_throttle enable row level security;
-- request_throttle няма политики: достъпна е единствено за сървъра.

create policy waitlist_admin_select on public.waitlist
  for select to authenticated using ((select public.is_admin()));
create policy waitlist_admin_update on public.waitlist
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy contact_messages_admin_select on public.contact_messages
  for select to authenticated using ((select public.is_admin()));
create policy contact_messages_admin_update on public.contact_messages
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
