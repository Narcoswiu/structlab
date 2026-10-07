-- Етап 4: профили, роли, планове за достъп, записвания, покани, обратна връзка.
--
-- Правила в този файл:
--   1. RLS е включен на всяка таблица.
--   2. Никоя таблица не е достъпна „по подразбиране“: правата (grant) се дават изрично.
--   3. Ролята на потребителя и достъпът му се променят само от сървъра (secret key)
--      или от admin – никога от самия студент.

-- ---------------------------------------------------------------------------
-- Типове
-- ---------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'student');
create type public.enrollment_source as enum ('stripe', 'manual', 'invite', 'beta');

-- ---------------------------------------------------------------------------
-- Таблици
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  role public.user_role not null default 'student',
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('light', 'sepia', 'dark')),
  font_size smallint not null default 2 check (font_size between 1 and 4),
  reader_mode text not null default 'easy' check (reader_mode in ('easy', 'detailed')),
  -- {"dashboard": true, "admin": true} – кои карета „Какво е тази страница“ са скрити
  intro_dismissed jsonb not null default '{}'::jsonb,
  reminders_enabled boolean not null default true,
  marketing_consent boolean not null default false,
  terms_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  title text not null,
  description text not null default '',
  sort_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.access_plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  price_eur numeric(10, 2) not null default 0 check (price_eur >= 0),
  duration_days integer not null check (duration_days between 1 and 3660),
  -- true = планът дава всички модули, включително бъдещите
  all_courses boolean not null default false,
  is_beta boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_courses (
  plan_id uuid not null references public.access_plans (id) on delete cascade,
  module_id uuid not null references public.modules (id) on delete cascade,
  primary key (plan_id, module_id)
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.access_plans (id) on delete restrict,
  source public.enrollment_source not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at >= starts_at)
);
create index enrollments_user_id_idx on public.enrollments (user_id);
create index enrollments_plan_id_idx on public.enrollments (plan_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null default '' check (char_length(full_name) <= 120),
  plan_id uuid not null references public.access_plans (id) on delete restrict,
  -- В базата стои само SHA-256 хешът на кода; самият код е единствено в линка.
  token_hash text not null unique,
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '14 days'),
  email_sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz
);
create index invites_email_idx on public.invites (email);
create index invites_plan_id_idx on public.invites (plan_id);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  page text not null check (char_length(page) <= 300),
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index feedback_user_id_idx on public.feedback (user_id);

-- ---------------------------------------------------------------------------
-- Помощни функции
-- (security definer = изпълняват се с правата на собственика, за да могат да
--  четат таблици, до които извикващият няма пряк достъп; search_path е празен,
--  за да не може никой да подмени таблица с чужда.)
-- ---------------------------------------------------------------------------
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.has_module_access(target_module uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.enrollments e
    join public.access_plans p on p.id = e.plan_id
    where e.user_id = (select auth.uid())
      and e.revoked_at is null
      and now() >= e.starts_at
      and now() < e.expires_at
      and (
        p.all_courses
        or exists (
          select 1 from public.plan_courses pc
          where pc.plan_id = p.id and pc.module_id = target_module
        )
      )
  );
$$;

-- Нов потребител в auth.users → автоматично профил и настройки.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  insert into public.user_settings (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_settings_touch
  before update on public.user_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Права (grants): първо отнемаме всичко, после даваме само нужното.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.has_module_access(uuid) to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select on public.user_settings to authenticated;
grant update (theme, font_size, reader_mode, intro_dismissed, reminders_enabled, marketing_consent)
  on public.user_settings to authenticated;

grant select, insert, update on public.modules to authenticated;
grant select, insert, update on public.access_plans to authenticated;
grant select, insert, delete on public.plan_courses to authenticated;
grant select, insert, update on public.enrollments to authenticated;
grant select, insert, update on public.invites to authenticated;
grant select, insert on public.feedback to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.modules enable row level security;
alter table public.access_plans enable row level security;
alter table public.plan_courses enable row level security;
alter table public.enrollments enable row level security;
alter table public.invites enable row level security;
alter table public.feedback enable row level security;

-- profiles: всеки вижда и редактира своя; admin вижда всички.
-- (ролята не може да се смени оттук – grant-ът по-горе е само за full_name)
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- user_settings: само собствените; admin може да ги чете.
create policy user_settings_select on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy user_settings_update_own on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- modules: студентът вижда само модулите, до които има активен достъп.
create policy modules_select on public.modules
  for select to authenticated
  using (
    (select public.is_admin())
    or (is_published and public.has_module_access(id))
  );

create policy modules_admin_insert on public.modules
  for insert to authenticated
  with check ((select public.is_admin()));

create policy modules_admin_update on public.modules
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- access_plans: активните планове са видими за всеки влязъл; admin управлява.
create policy access_plans_select on public.access_plans
  for select to authenticated
  using (is_active or (select public.is_admin()));

create policy access_plans_admin_insert on public.access_plans
  for insert to authenticated
  with check ((select public.is_admin()));

create policy access_plans_admin_update on public.access_plans
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- plan_courses: само admin (студентът научава достъпа си през modules).
create policy plan_courses_admin_select on public.plan_courses
  for select to authenticated
  using ((select public.is_admin()));

create policy plan_courses_admin_insert on public.plan_courses
  for insert to authenticated
  with check ((select public.is_admin()));

create policy plan_courses_admin_delete on public.plan_courses
  for delete to authenticated
  using ((select public.is_admin()));

-- enrollments: студентът вижда своите; само admin създава и променя.
create policy enrollments_select on public.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy enrollments_admin_insert on public.enrollments
  for insert to authenticated
  with check ((select public.is_admin()));

create policy enrollments_admin_update on public.enrollments
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- invites: само admin. Приемането на покана става на сървъра със secret key.
create policy invites_admin_select on public.invites
  for select to authenticated
  using ((select public.is_admin()));

create policy invites_admin_insert on public.invites
  for insert to authenticated
  with check ((select public.is_admin()));

create policy invites_admin_update on public.invites
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- feedback: всеки пише от свое име; чете своето, admin чете всичко.
create policy feedback_insert_own on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy feedback_select on public.feedback
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Начални данни
-- ---------------------------------------------------------------------------
insert into public.modules (slug, title, description, sort_order)
values (
  'saprotivlenie-na-materialite',
  'Съпротивление на материалите',
  'Разрезни усилия, геометрични характеристики, напрежения, огъване, усукване, изкълчване.',
  1
);

insert into public.access_plans (slug, name, price_eur, duration_days, all_courses, is_beta)
values ('beta-free', 'Безплатен достъп', 0, 14, true, true);
