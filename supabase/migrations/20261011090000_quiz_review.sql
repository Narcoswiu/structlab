-- Въпроси „Провери се“ с повторение през интервали (метод на Лайтнер).
--
-- quiz_questions – въпросите от главите; качват се заедно с текста.
-- quiz_reviews   – за всеки потребител и въпрос: в коя „кутия“ е и кога се
--                  пада следващото повторение.
--
-- Кутии и интервали: 1 → след 1 ден, 2 → след 3, 3 → след 7, 4 → след 14 дни,
-- 5 → научен (повече не се показва). Сгрешен въпрос се връща в кутия 1.
--
-- Никой клиент не пише директно: отговорите минават през сървъра, който
-- проверява кой е потребителят и дали има достъп до главата.

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  mode public.content_mode not null,
  -- отпечатък на текста на въпроса: остава същият, докато въпросът не се промени
  key text not null check (key ~ '^[a-f0-9]{16}$'),
  position smallint not null check (position > 0),
  question text not null check (length(question) between 1 and 4000),
  answer text not null check (length(answer) between 1 and 4000),
  unique (chapter_id, mode, key)
);
create index quiz_questions_chapter_idx on public.quiz_questions (chapter_id, mode, position);

create table public.quiz_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  box smallint not null check (box between 1 and 5),
  -- ден на следващото повторение (по българско време); null = научен
  due_on date,
  attempts integer not null default 0 check (attempts >= 0),
  correct integer not null default 0 check (correct >= 0 and correct <= attempts),
  last_knew boolean not null,
  first_answered_at timestamptz not null default now(),
  last_answered_at timestamptz not null default now(),
  primary key (user_id, question_id),
  check ((box = 5) = (due_on is null))
);
create index quiz_reviews_due_idx on public.quiz_reviews (user_id, due_on);
create index quiz_reviews_question_idx on public.quiz_reviews (question_id);

-- След колко дни се повтаря въпрос от дадена кутия.
create function public.review_interval_days(p_box smallint) returns integer
language sql immutable set search_path = ''
as $$
  select case p_box when 1 then 1 when 2 then 3 when 3 then 7 when 4 then 14 end
$$;

/**
 * Записва един отговор („знаех го“ / „не го знаех“) и насрочва повторението.
 *
 *  - първи отговор или грешен отговор → кутия 1, повторение утре;
 *  - верен отговор в деня на повторението или след него → следващата кутия;
 *  - верен отговор ПРЕДИ деня на повторението не мести въпроса напред
 *    (иначе с няколко щраквания подред всичко би станало „научено“).
 *
 * Връща limited = true и не записва нищо при повече от 30 отговора в минута.
 */
create function public.record_quiz_answer(
  p_user uuid,
  p_question uuid,
  p_knew boolean
)
returns table (box smallint, due_on date, limited boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_ts timestamptz := now();
  today date := public.activity_day(now());
  recent integer;
  prev public.quiz_reviews%rowtype;
  new_box smallint;
  new_due date;
begin
  select count(*) into recent
  from public.quiz_reviews r
  where r.user_id = p_user and r.last_answered_at > now_ts - interval '60 seconds';
  if recent >= 30 then
    return query select null::smallint, null::date, true;
    return;
  end if;

  select * into prev
  from public.quiz_reviews r
  where r.user_id = p_user and r.question_id = p_question
  for update;

  if not found then
    insert into public.quiz_reviews (
      user_id, question_id, box, due_on, attempts, correct, last_knew,
      first_answered_at, last_answered_at
    )
    values (
      p_user, p_question, 1, today + 1, 1, case when p_knew then 1 else 0 end,
      p_knew, now_ts, now_ts
    );
    return query select 1::smallint, today + 1, false;
    return;
  end if;

  if not p_knew then
    new_box := 1;
    new_due := today + 1;
  elsif prev.due_on is null or prev.due_on > today then
    -- научен въпрос или твърде ранен верен отговор: графикът не се променя
    new_box := prev.box;
    new_due := prev.due_on;
  else
    new_box := prev.box + 1;
    new_due := case when new_box >= 5 then null
                    else today + public.review_interval_days(new_box) end;
  end if;

  update public.quiz_reviews r
  set box = new_box,
      due_on = new_due,
      attempts = r.attempts + 1,
      correct = r.correct + case when p_knew then 1 else 0 end,
      last_knew = p_knew,
      last_answered_at = now_ts
  where r.user_id = p_user and r.question_id = p_question;

  return query select new_box, new_due, false;
end;
$$;

revoke all on public.quiz_questions, public.quiz_reviews from anon, authenticated;
revoke all on function public.record_quiz_answer(uuid, uuid, boolean)
  from public, anon, authenticated;
revoke all on function public.review_interval_days(smallint) from public, anon;

grant select on public.quiz_questions, public.quiz_reviews to authenticated;
grant select, insert, update, delete
  on public.quiz_questions, public.quiz_reviews to service_role;
grant execute on function public.record_quiz_answer(uuid, uuid, boolean) to service_role;
grant execute on function public.review_interval_days(smallint) to authenticated, service_role;

alter table public.quiz_questions enable row level security;
alter table public.quiz_reviews enable row level security;

-- Въпросите се виждат от същите хора, които могат да четат главата.
create policy quiz_questions_select on public.quiz_questions
  for select to authenticated
  using (public.can_read_chapter(chapter_id));

-- Всеки вижда само своите отговори; admin вижда всички. Никой клиент не пише.
create policy quiz_reviews_select on public.quiz_reviews
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
