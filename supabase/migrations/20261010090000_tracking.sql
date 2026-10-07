-- Етап 7: проследяване на ученето.
--
-- Суровите събития (events) се пазят до 12 месеца. От тях се поддържат две
-- обобщени таблици: progress (докъде е стигнал потребителят във всяка глава)
-- и daily_activity (колко време е учил всеки ден).
--
-- Никой клиент не пише директно в тези таблици: събитията минават през
-- /api/events на сървъра (проверка на данните и ограничение на честотата).
-- Нищо не се записва, преди потребителят да е видял известието за това.

create type public.event_type as enum (
  'login',
  'chapter_open',
  'section_view',
  'heartbeat',
  'mode_toggle',
  'pdf_download',
  'lab_open'
);

alter table public.user_settings
  add column tracking_notice_accepted_at timestamptz;

create table public.events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.event_type not null,
  chapter_id uuid references public.chapters (id) on delete set null,
  section text check (section is null or section ~ '^[a-z0-9-]{1,40}$'),
  mode public.content_mode,
  lab text check (lab is null or lab ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now()
);
create index events_user_created_idx on public.events (user_id, created_at desc);
create index events_created_idx on public.events (created_at);
create index events_chapter_idx on public.events (chapter_id);

create table public.progress (
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  -- кои от секциите на главата е видял (id-та от CHAPTER_SECTIONS)
  sections_seen text[] not null default '{}',
  last_section text,
  last_mode public.content_mode,
  seconds integer not null default 0 check (seconds >= 0),
  first_opened_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  primary key (user_id, chapter_id)
);
create index progress_chapter_idx on public.progress (chapter_id);

create table public.daily_activity (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  seconds integer not null default 0 check (seconds >= 0),
  events integer not null default 0 check (events >= 0),
  primary key (user_id, day)
);
create index daily_activity_day_idx on public.daily_activity (day);

-- Един „пулс“ (heartbeat) се праща на 15 секунди при видим таб.
create function public.heartbeat_seconds() returns integer
language sql immutable set search_path = '' as $$ select 15 $$;

-- Денят се брои по българско време.
create function public.activity_day(moment timestamptz) returns date
language sql immutable set search_path = ''
as $$ select (moment at time zone 'Europe/Sofia')::date $$;

/**
 * Записва едно събитие и веднага обновява progress и daily_activity.
 * Връща false, ако потребителят е надхвърлил лимита (30 събития в минута) –
 * тогава нищо не се записва.
 */
create function public.record_event(
  p_user uuid,
  p_type public.event_type,
  p_chapter uuid default null,
  p_section text default null,
  p_mode public.content_mode default null,
  p_lab text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent integer;
  now_ts timestamptz := now();
begin
  select count(*) into recent
  from public.events
  where user_id = p_user and created_at > now_ts - interval '60 seconds';
  if recent >= 30 then
    return false;
  end if;

  insert into public.events (user_id, type, chapter_id, section, mode, lab, created_at)
  values (p_user, p_type, p_chapter, p_section, p_mode, p_lab, now_ts);

  insert into public.daily_activity (user_id, day, seconds, events)
  values (
    p_user,
    public.activity_day(now_ts),
    case when p_type = 'heartbeat' then public.heartbeat_seconds() else 0 end,
    1
  )
  on conflict (user_id, day) do update
    set seconds = public.daily_activity.seconds + excluded.seconds,
        events = public.daily_activity.events + 1;

  if p_chapter is not null then
    insert into public.progress as p (
      user_id, chapter_id, sections_seen, last_section, last_mode, seconds,
      first_opened_at, last_activity_at
    )
    values (
      p_user,
      p_chapter,
      case when p_type = 'section_view' and p_section is not null
           then array[p_section] else '{}'::text[] end,
      p_section,
      p_mode,
      case when p_type = 'heartbeat' then public.heartbeat_seconds() else 0 end,
      now_ts,
      now_ts
    )
    on conflict (user_id, chapter_id) do update
      set sections_seen = case
            when p_type = 'section_view' and p_section is not null
                 and not (p_section = any (p.sections_seen))
              then p.sections_seen || p_section
            else p.sections_seen
          end,
          last_section = coalesce(p_section, p.last_section),
          last_mode = coalesce(p_mode, p.last_mode),
          seconds = p.seconds + excluded.seconds,
          last_activity_at = now_ts;
  end if;

  return true;
end;
$$;

/**
 * Нощна агрегация: изтрива суровите събития, по-стари от 12 месеца, и
 * преизчислява progress и daily_activity изцяло от останалите събития.
 * Суровите събития са източникът на истината; ако бързото обновяване в
 * record_event някога се размине, тази функция го поправя.
 */
create function public.rebuild_aggregates()
returns table (purged bigint, progress_rows bigint, activity_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purged bigint;
  v_progress bigint;
  v_activity bigint;
begin
  delete from public.events where created_at < now() - interval '12 months';
  get diagnostics v_purged = row_count;

  delete from public.daily_activity where true;
  insert into public.daily_activity (user_id, day, seconds, events)
  select
    e.user_id,
    public.activity_day(e.created_at),
    (count(*) filter (where e.type = 'heartbeat')) * public.heartbeat_seconds(),
    count(*)
  from public.events e
  group by e.user_id, public.activity_day(e.created_at);
  get diagnostics v_activity = row_count;

  delete from public.progress where true;
  insert into public.progress (
    user_id, chapter_id, sections_seen, last_section, last_mode, seconds,
    first_opened_at, last_activity_at
  )
  select
    e.user_id,
    e.chapter_id,
    coalesce(
      (
        select array_agg(s.section order by s.first_seen)
        from (
          select e2.section, min(e2.created_at) as first_seen
          from public.events e2
          where e2.user_id = e.user_id and e2.chapter_id = e.chapter_id
            and e2.type = 'section_view' and e2.section is not null
          group by e2.section
        ) s
      ),
      '{}'::text[]
    ),
    (
      select e3.section from public.events e3
      where e3.user_id = e.user_id and e3.chapter_id = e.chapter_id
        and e3.section is not null
      order by e3.created_at desc, e3.id desc limit 1
    ),
    (
      select e4.mode from public.events e4
      where e4.user_id = e.user_id and e4.chapter_id = e.chapter_id
        and e4.mode is not null
      order by e4.created_at desc, e4.id desc limit 1
    ),
    (count(*) filter (where e.type = 'heartbeat')) * public.heartbeat_seconds(),
    min(e.created_at),
    max(e.created_at)
  from public.events e
  where e.chapter_id is not null
  group by e.user_id, e.chapter_id;
  get diagnostics v_progress = row_count;

  return query select v_purged, v_progress, v_activity;
end;
$$;

revoke all on public.events, public.progress, public.daily_activity
  from anon, authenticated;
revoke all on function public.record_event(uuid, public.event_type, uuid, text, public.content_mode, text)
  from public, anon, authenticated;
revoke all on function public.rebuild_aggregates() from public, anon, authenticated;

grant select on public.events, public.progress, public.daily_activity to authenticated;
grant select, insert, update, delete
  on public.events, public.progress, public.daily_activity to service_role;
grant execute on function public.record_event(uuid, public.event_type, uuid, text, public.content_mode, text)
  to service_role;
grant execute on function public.rebuild_aggregates() to service_role;
grant execute on function public.heartbeat_seconds() to authenticated, service_role;
grant execute on function public.activity_day(timestamptz) to authenticated, service_role;

alter table public.events enable row level security;
alter table public.progress enable row level security;
alter table public.daily_activity enable row level security;

-- Всеки вижда само своите данни; admin вижда всички. Никой клиент не пише.
create policy events_select on public.events
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy progress_select on public.progress
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy daily_activity_select on public.daily_activity
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
