-- Курсови: студентът решава курсова задача със СВОИТЕ данни.
--
-- coursework          – една курсова: вид (напр. „greda-sechenie“) и даденото
--                       (дължини, опори, товари, сечение). Решението и верните
--                       отговори НЕ са в базата: смятат се на сървъра от даденото.
-- coursework_steps    – докъде е стигнал студентът по всяка стъпка: последно
--                       въведеното, кои числа са верни, брой проверки, показано
--                       ли е решението на стъпката.
-- coursework_requests – заявка „Искам помощ за довършване“. Към една курсова
--                       има най-много една отворена заявка (нова или в работа).
-- coursework_request_notes – вътрешни бележки на екипа към заявка. Отделна
--                       таблица, за да не може студентът да ги прочете по
--                       никакъв начин: до нея стига само администратор.
--
-- Никой клиент не пише директно: записва сървърът (secret key), след като
-- провери кой е потребителят и самите данни.

create table public.coursework (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z0-9-]{1,40}$'),
  title text not null check (char_length(title) between 1 and 80),
  -- даденото, проверено от сървъра преди запис
  givens jsonb not null
    check (jsonb_typeof(givens) = 'object' and pg_column_size(givens) <= 16000),
  -- кога студентът е отворил пълното решение за първи път
  solution_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- за съставния външен ключ: ред в стъпките и заявките е винаги на собственика
  unique (id, user_id)
);
create index coursework_user_created_idx
  on public.coursework (user_id, created_at desc);
create index coursework_created_idx on public.coursework (created_at desc);

create table public.coursework_steps (
  coursework_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  step text not null check (step ~ '^[a-z0-9-]{1,40}$'),
  -- последно въведеното: {"A": 18, "B": 12}
  answers jsonb not null default '{}'::jsonb
    check (jsonb_typeof(answers) = 'object' and pg_column_size(answers) <= 8000),
  -- кои числа са верни: {"A": true, "B": false}
  results jsonb not null default '{}'::jsonb
    check (jsonb_typeof(results) = 'object' and pg_column_size(results) <= 8000),
  attempts integer not null default 0 check (attempts >= 0),
  wrong_attempts integer not null default 0
    check (wrong_attempts >= 0 and wrong_attempts <= attempts),
  revealed_at timestamptz,
  solved_at timestamptz,
  first_checked_at timestamptz,
  last_checked_at timestamptz,
  primary key (coursework_id, step),
  foreign key (coursework_id, user_id)
    references public.coursework (id, user_id) on delete cascade
);
create index coursework_steps_user_idx on public.coursework_steps (user_id);

create table public.coursework_requests (
  id uuid primary key default gen_random_uuid(),
  coursework_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  note text not null check (char_length(note) between 3 and 2000),
  deadline date,
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'done', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  handled_by uuid references auth.users (id) on delete set null,
  foreign key (coursework_id, user_id)
    references public.coursework (id, user_id) on delete cascade
);
-- най-много една отворена заявка на курсова
create unique index coursework_requests_one_open_idx
  on public.coursework_requests (coursework_id)
  where status in ('new', 'in_progress');
create index coursework_requests_status_created_idx
  on public.coursework_requests (status, created_at desc);
create index coursework_requests_user_idx
  on public.coursework_requests (user_id);
create index coursework_requests_coursework_idx
  on public.coursework_requests (coursework_id, created_at desc);

create table public.coursework_request_notes (
  request_id uuid primary key
    references public.coursework_requests (id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

revoke all on
  public.coursework,
  public.coursework_steps,
  public.coursework_requests,
  public.coursework_request_notes
from anon, authenticated;

grant select on
  public.coursework,
  public.coursework_steps,
  public.coursework_requests,
  public.coursework_request_notes
to authenticated;

grant select, insert, update, delete on
  public.coursework,
  public.coursework_steps,
  public.coursework_requests,
  public.coursework_request_notes
to service_role;

alter table public.coursework enable row level security;
alter table public.coursework_steps enable row level security;
alter table public.coursework_requests enable row level security;
alter table public.coursework_request_notes enable row level security;

-- Всеки вижда само своите; admin вижда всички. Никой клиент не пише.
create policy coursework_select on public.coursework
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy coursework_steps_select on public.coursework_steps
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy coursework_requests_select on public.coursework_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Вътрешните бележки: само администратор. Студентът не ги вижда и за своята
-- заявка.
create policy coursework_request_notes_admin_select
  on public.coursework_request_notes
  for select to authenticated
  using ((select public.is_admin()));
