-- Ограничение на имейлите „линк за вход / нова парола“.
--
-- Без него всеки може да натиска „Забравена парола“ за чужд адрес и да засипе
-- пощата му с писма от нашия подател. Таблицата пази само хеш на адреса и час –
-- никакви лични данни в явен вид. Достъпна е единствено за сървъра.

create table public.login_link_requests (
  id bigint generated always as identity primary key,
  email_hash text not null check (email_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index login_link_requests_lookup_idx
  on public.login_link_requests (email_hash, created_at desc);
create index login_link_requests_created_idx
  on public.login_link_requests (created_at desc);

alter table public.login_link_requests enable row level security;
-- Без политики: anon и authenticated нямат никакъв достъп, дори с грешно дадени права.
revoke all on public.login_link_requests from anon, authenticated;
grant select, insert, delete on public.login_link_requests to service_role;
