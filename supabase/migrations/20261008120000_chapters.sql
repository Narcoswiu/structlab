-- Етап 6: глави на учебника.
--
-- Съдържанието е в базата, не в кода: вижда го само човек с активен достъп до
-- модула. Всяка глава има два текста – „Леко“ и „Подробно“ – във формат
-- Markdown, и фигури (SVG). Записва ги само сървърът (secret key).

create type public.content_mode as enum ('easy', 'detailed');

create table public.chapters (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.modules (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  number integer not null check (number > 0),
  title text not null,
  summary text not null default '',
  -- списък с източници: [{"title": "...", "url": "..."}]
  sources jsonb not null default '[]'::jsonb,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (module_id, slug),
  unique (module_id, number)
);

create table public.chapter_bodies (
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  mode public.content_mode not null,
  body text not null,
  updated_at timestamptz not null default now(),
  primary key (chapter_id, mode)
);

create table public.chapter_figures (
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  name text not null check (name ~ '^[a-z0-9-]+$'),
  svg text not null,
  primary key (chapter_id, name)
);

-- Може ли влезлият потребител да чете тази глава.
create function public.can_read_chapter(target_chapter uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.chapters c
    where c.id = target_chapter
      and (
        (select public.is_admin())
        or (c.is_published and public.has_module_access(c.module_id))
      )
  );
$$;

revoke all on public.chapters, public.chapter_bodies, public.chapter_figures
  from anon, authenticated;
revoke all on function public.can_read_chapter(uuid) from public, anon, authenticated;

grant execute on function public.can_read_chapter(uuid) to authenticated, service_role;
grant select on public.chapters, public.chapter_bodies, public.chapter_figures
  to authenticated;
grant select, insert, update, delete
  on public.chapters, public.chapter_bodies, public.chapter_figures
  to service_role;

alter table public.chapters enable row level security;
alter table public.chapter_bodies enable row level security;
alter table public.chapter_figures enable row level security;

create policy chapters_select on public.chapters
  for select to authenticated
  using (
    (select public.is_admin())
    or (is_published and public.has_module_access(module_id))
  );

create policy chapter_bodies_select on public.chapter_bodies
  for select to authenticated
  using (public.can_read_chapter(chapter_id));

create policy chapter_figures_select on public.chapter_figures
  for select to authenticated
  using (public.can_read_chapter(chapter_id));
