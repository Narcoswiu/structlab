-- Планове без срок („завинаги“) – за първите поканени потребители.
--
-- is_lifetime = true означава, че достъпът не изтича. В enrollments.expires_at
-- се записва далечна дата (2999-12-31), за да останат в сила всички проверки
-- „now() < expires_at“ без специални случаи; duration_days не се използва.

alter table public.access_plans
  add column is_lifetime boolean not null default false;

insert into public.access_plans
  (slug, name, price_eur, duration_days, all_courses, is_beta, is_lifetime)
values
  ('founders-free', 'Безплатен достъп завинаги', 0, 3660, true, true, true);
