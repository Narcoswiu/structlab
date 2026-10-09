import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Главният ключ на напомнянията (app_settings, ред „reminders“).
 * Докато не е изрично {"enabled": true}, нито едно напомняне не тръгва към
 * студент. Липсващ ред, грешка при четене или странна стойност = ИЗКЛЮЧЕНО.
 */
export type RemindersSwitch = {
  enabled: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const REMINDERS_KEY = "reminders";

export async function getRemindersSwitch(
  db: SupabaseClient<Database>,
): Promise<RemindersSwitch> {
  const { data, error } = await db
    .from("app_settings")
    .select("value, updated_at, updated_by")
    .eq("key", REMINDERS_KEY)
    .maybeSingle();
  if (error || !data) {
    return { enabled: false, updatedAt: null, updatedBy: null };
  }
  const value = data.value;
  const enabled =
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    value.enabled === true;
  return { enabled, updatedAt: data.updated_at, updatedBy: data.updated_by };
}
