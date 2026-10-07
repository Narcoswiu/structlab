-- Каталог: университет → специалност → курс → семестър → дисциплина.
--
-- Учебните планове са ДАННИ, не код: зареждат се от content/catalog.yml със
-- скрипта `pnpm catalog:push`. Една дисциплина може да сочи към модул със
-- съдържание (modules); един модул се ползва от много специалности.

create table public.universities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  short_name text not null,
  name text not null,
  sort_order integer not null default 0
);

create table public.specialties (
  id uuid primary key default gen_random_uuid(),
  university_id uuid not null references public.universities (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  short_name text not null,
  name text not null,
  degree text not null,
  years integer not null check (years between 1 and 8),
  -- откъде са данните и към коя учебна година
  note text not null default '',
  sort_order integer not null default 0,
  unique (university_id, slug)
);

create type public.term as enum ('winter', 'summer');

create table public.curriculum_items (
  id uuid primary key default gen_random_uuid(),
  specialty_id uuid not null references public.specialties (id) on delete cascade,
  year integer not null check (year between 1 and 8),
  term public.term not null,
  title text not null,
  module_id uuid references public.modules (id) on delete set null,
  sort_order integer not null default 0
);
create index curriculum_items_specialty_idx
  on public.curriculum_items (specialty_id, year, term, sort_order);
create index curriculum_items_module_idx on public.curriculum_items (module_id);

-- Специалността, която потребителят е избрал за себе си.
alter table public.profiles
  add column specialty_id uuid references public.specialties (id) on delete set null;
create index profiles_specialty_idx on public.profiles (specialty_id);

revoke all on public.universities, public.specialties, public.curriculum_items
  from anon, authenticated;
grant select on public.universities, public.specialties, public.curriculum_items
  to authenticated;
grant select, insert, update, delete
  on public.universities, public.specialties, public.curriculum_items
  to service_role;
-- потребителят може да смени името и специалността си, но не и ролята
grant update (specialty_id) on public.profiles to authenticated;

alter table public.universities enable row level security;
alter table public.specialties enable row level security;
alter table public.curriculum_items enable row level security;

-- Учебните планове са публична информация: вижда ги всеки влязъл потребител.
-- Записва ги само сървърът.
create policy universities_select on public.universities
  for select to authenticated using (true);
create policy specialties_select on public.specialties
  for select to authenticated using (true);
create policy curriculum_items_select on public.curriculum_items
  for select to authenticated using (true);

-- Името на модула трябва да се вижда в учебния план и без активен достъп
-- (самото съдържание остава защитено от политиките на chapters).
create function public.module_titles()
returns table (id uuid, slug text, title text, chapter_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.slug, m.title,
         (select count(*) from public.chapters c
           where c.module_id = m.id and c.is_published)
  from public.modules m
  where m.is_published;
$$;
revoke all on function public.module_titles() from public, anon, authenticated;
grant execute on function public.module_titles() to authenticated, service_role;
