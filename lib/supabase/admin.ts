import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "./database.types";

/**
 * Клиент със secret key: ЗАОБИКАЛЯ RLS. Използва се само на сървъра и само
 * там, където няма влязъл потребител или трябва да се създаде акаунт
 * (приемане на покана, линк за нова парола).
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
