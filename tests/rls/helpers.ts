import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

type LocalStatus = {
  API_URL: string;
  PUBLISHABLE_KEY: string;
  SECRET_KEY: string;
};

/** Адресът и ключовете на ЛОКАЛНАТА база – никога на истинската. */
export function getLocalSupabase(): LocalStatus {
  const raw = execFileSync(
    "pnpm",
    ["exec", "supabase", "status", "-o", "json"],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    },
  );
  const status = JSON.parse(raw.slice(raw.indexOf("{"))) as LocalStatus;
  if (!/^http:\/\/(127\.0\.0\.1|localhost):/.test(status.API_URL)) {
    throw new Error("Тестовете за RLS се пускат само срещу локалната база.");
  }
  return status;
}

export type Db = SupabaseClient<Database>;

const noSession = { auth: { autoRefreshToken: false, persistSession: false } };

export function serviceClient(status: LocalStatus): Db {
  return createClient<Database>(status.API_URL, status.SECRET_KEY, noSession);
}

export function anonClient(status: LocalStatus): Db {
  return createClient<Database>(
    status.API_URL,
    status.PUBLISHABLE_KEY,
    noSession,
  );
}

const PASSWORD = "test-password-123456";

/** Създава потребител и връща клиент, влязъл от негово име (минава през RLS). */
export async function createSignedInUser(
  status: LocalStatus,
  service: Db,
  label: string,
): Promise<{ id: string; email: string; client: Db }> {
  const email = `${label}-${crypto.randomUUID().slice(0, 8)}@rls.test`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: label },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");

  const client = anonClient(status);
  const signIn = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signIn.error) throw signIn.error;
  return { id: data.user.id, email, client };
}
