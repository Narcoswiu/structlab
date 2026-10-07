import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { E2E_ADMIN, E2E_READER, getLocalSupabase } from "./local-supabase";

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

  const reader = await service.auth.admin.createUser({
    email: E2E_READER.email,
    password: E2E_READER.password,
    email_confirm: true,
    user_metadata: { full_name: "Тест Читател" },
  });
  if (reader.error || !reader.data.user)
    throw reader.error ?? new Error("reader");
  const { data: plan } = await service
    .from("access_plans")
    .select("id")
    .eq("slug", "beta-free")
    .single();
  await service.from("enrollments").insert({
    user_id: reader.data.user.id,
    plan_id: plan!.id,
    source: "beta",
    expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Главите на учебника (ако са налични на тази машина) – в локалната база.
  execFileSync("node", ["scripts/catalog.mts", "push", "--local"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  execFileSync("node", ["scripts/content.mts", "push", "--local"], {
    stdio: ["ignore", "ignore", "inherit"],
  });
}
