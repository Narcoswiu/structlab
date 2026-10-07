-- Права за сървърния ключ (service_role).
--
-- Проектът е създаден с изключено „Automatically expose new tables“, затова
-- нито една роля не получава права автоматично – включително service_role,
-- с която работи сървърът (secret key): приемане на покана, създаване на
-- акаунт, първи администратор. Даваме ѝ ги изрично, таблица по таблица.

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.profiles,
  public.user_settings,
  public.modules,
  public.access_plans,
  public.plan_courses,
  public.enrollments,
  public.invites,
  public.feedback
to service_role;

grant execute on function public.is_admin() to service_role;
grant execute on function public.has_module_access(uuid) to service_role;
