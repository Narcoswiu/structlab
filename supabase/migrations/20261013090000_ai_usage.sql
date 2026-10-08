-- AI асистент: дневен брояч на въпросите към външната AI услуга.
--
-- ai_usage – за всеки потребител и ден (по българско време): колко въпроса е
--            задал. Самите въпроси и отговори НЕ се записват никъде.
--
-- Броячът се ползва само когато AI услугата е включена. Никой клиент не пише
-- директно: увеличава го сървърът през consume_ai_request.

create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  requests integer not null default 0 check (requests >= 0),
  primary key (user_id, day)
);

/**
 * Отброява един въпрос за днес, ако потребителят е под лимита.
 * Проверката и увеличението са една операция – два едновременни въпроса не
 * могат да минат и двата над лимита.
 *
 * Връща allowed = false и не променя нищо, когато лимитът е стигнат;
 * used е броят на въпросите за днес след извикването.
 */
create function public.consume_ai_request(p_user uuid, p_limit integer)
returns table (allowed boolean, used integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := public.activity_day(now());
  new_used integer;
begin
  if p_limit is not null and p_limit > 0 then
    insert into public.ai_usage as u (user_id, day, requests)
    values (p_user, today, 1)
    on conflict (user_id, day) do update
      set requests = u.requests + 1
      where u.requests < p_limit
    returning u.requests into new_used;
  end if;

  if new_used is not null then
    return query select true, new_used;
    return;
  end if;

  select u.requests into new_used
  from public.ai_usage u
  where u.user_id = p_user and u.day = today;
  return query select false, coalesce(new_used, 0);
end;
$$;

revoke all on public.ai_usage from anon, authenticated;
revoke all on function public.consume_ai_request(uuid, integer)
  from public, anon, authenticated;

grant select on public.ai_usage to authenticated;
grant select, insert, update, delete on public.ai_usage to service_role;
grant execute on function public.consume_ai_request(uuid, integer) to service_role;

alter table public.ai_usage enable row level security;

-- Всеки вижда само своя брояч; admin вижда всички. Никой клиент не пише.
create policy ai_usage_select on public.ai_usage
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
