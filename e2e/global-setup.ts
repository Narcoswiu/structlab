import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, getLocalSupabase } from "./local-supabase";

// Преди тестовете: чист admin акаунт в локалната база и без стари тестови данни.
export default async function globalSetup() {
  const status = getLocalSupabase();
  const service = createClient(status.API_URL, status.SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list } = await service.auth.admin.listUsers({ perPage: 1000 });
  for (const user of list?.users ?? []) {
    if (user.email?.endsWith("@structlab.test")) {
      await service.auth.admin.deleteUser(user.id);
    }
  }
  await service.from("invites").delete().like("email", "%@structlab.test");

  const { data, error } = await service.auth.admin.createUser({
    email: E2E_ADMIN.email,
    password: E2E_ADMIN.password,
    email_confirm: true,
    user_metadata: { full_name: "Тест Админ" },
  });
  if (error || !data.user)
    throw error ?? new Error("Не успях да създам admin.");
  await service
    .from("profiles")
    .update({ role: "admin" })
    .eq("id", data.user.id);
}
