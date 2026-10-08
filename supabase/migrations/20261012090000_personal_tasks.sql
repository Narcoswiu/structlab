-- Лични задания: задачи с числа според факултетния номер.
--
-- Самият факултетен номер НЕ се пази. Пази се само „вариантът“ – последните
-- три цифри (a, b, c), от които се смятат числата в задачите.
--
-- task_variants  – вариантът на потребителя.
-- personal_tasks – последно въведените отговори по всяка задача и кои от тях
--                  са верни. Условията и верните отговори не са в базата:
--                  смятат се на сървъра от варианта.
--
-- Никой клиент не пише директно: записва сървърът, след като провери кой е
-- потребителят и самите отговори.

create table public.task_variants (
  user_id uuid primary key references auth.users (id) on delete cascade,
  a smallint not null check (a between 0 and 9),
  b smallint not null check (b between 0 and 9),
  c smallint not null check (c between 0 and 9),
  created_at timestamptz not null default now()
);

create table public.personal_tasks (
  user_id uuid not null references auth.users (id) on delete cascade,
  template text not null check (template ~ '^[a-z0-9-]{1,60}$'),
  -- последно въведеното: {"A": 52.4, "MA": 106.24}
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  -- кои отговори са верни: {"A": true, "MA": false}
  results jsonb not null default '{}'::jsonb check (jsonb_typeof(results) = 'object'),
  attempts integer not null default 0 check (attempts >= 0),
  solved_at timestamptz,
  first_checked_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  primary key (user_id, template)
);

revoke all on public.task_variants, public.personal_tasks from anon, authenticated;
grant select on public.task_variants, public.personal_tasks to authenticated;
grant select, insert, update, delete
  on public.task_variants, public.personal_tasks to service_role;

alter table public.task_variants enable row level security;
alter table public.personal_tasks enable row level security;

-- Всеки вижда само своите; admin вижда всички. Никой клиент не пише.
create policy task_variants_select on public.task_variants
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy personal_tasks_select on public.personal_tasks
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
