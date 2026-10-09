-- Напомняния по имейл.
--
-- app_settings – общи настройки на платформата. Засега един ред: „reminders“ с
--                главния ключ {"enabled": false}. Докато е false, нито едно
--                напомняне не тръгва към студент. Сменя го само администратор.
-- user_settings.unsubscribe_token – случаен код за линка „Спри напомнянията“
--                в писмата; с него напомнянията се спират без вход.
-- email_log    – кога какъв вид писмо е тръгнало към кой потребител. Адреси и
--                текстове на писма НЕ се записват.
--
-- Никой клиент не пише в email_log: записва само сървърът (secret key).

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.app_settings (key, value)
values ('reminders', '{"enabled": false}'::jsonb);

alter table public.user_settings
  add column unsubscribe_token uuid not null default gen_random_uuid();
create unique index user_settings_unsubscribe_token_idx
  on public.user_settings (unsubscribe_token);

create table public.email_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null
    check (kind in ('review_due', 'continue', 'weekly', 'new_chapter', 'test')),
  status text not null check (status in ('sent', 'failed')),
  -- кратък клас на грешката (напр. EAUTH); никога адрес или текст на писмо
  error text check (error is null or length(error) <= 60),
  sent_at timestamptz not null default now()
);
create index email_log_user_sent_idx on public.email_log (user_id, sent_at desc);

revoke all on public.app_settings, public.email_log from anon, authenticated;

grant select, update on public.app_settings to authenticated;
grant select on public.email_log to authenticated;
grant select, insert, update, delete
  on public.app_settings, public.email_log to service_role;

alter table public.app_settings enable row level security;
alter table public.email_log enable row level security;

-- Настройките вижда и сменя само администратор. Редове не се добавят и не се
-- трият от клиент.
create policy app_settings_admin_select on public.app_settings
  for select to authenticated
  using ((select public.is_admin()));
create policy app_settings_admin_update on public.app_settings
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Всеки вижда само своите писма; admin вижда всички. Никой клиент не пише.
create policy email_log_select on public.email_log
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
