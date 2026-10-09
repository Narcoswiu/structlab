import "server-only";
import { z } from "zod";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.uuid();

/**
 * Спира напомнянията за собственика на кода от линка в писмото.
 *
 * Не връща нищо нарочно: извикващият показва едно и също при валиден, вече
 * използван и несъществуващ код, за да не се разбира кои кодове съществуват.
 * Повторно извикване не променя нищо.
 */
export async function unsubscribeByToken(token: string): Promise<void> {
  const parsed = tokenSchema.safeParse(token);
  if (!parsed.success) return;
  await createAdminClient()
    .from("user_settings")
    .update({ reminders_enabled: false })
    .eq("unsubscribe_token", parsed.data)
    .eq("reminders_enabled", true);
}

/** Страницата „Спиране на напомнянията“ – линкът в края на всяко писмо. */
export function unsubscribePageUrl(token: string): string {
  return absoluteUrl(`/unsubscribe/${token}`);
}

/**
 * Адресът за заглавката „List-Unsubscribe“: пощенските клиенти пращат POST към
 * него (RFC 8058). Страница не може да приеме такъв POST, затова е отделен
 * адрес; отворен в браузър (GET), той само препраща към страницата.
 */
export function unsubscribeOneClickUrl(token: string): string {
  return absoluteUrl(`/api/unsubscribe/${token}`);
}
