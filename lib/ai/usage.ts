import "server-only";
import { createHmac } from "node:crypto";
import { serverEnv } from "@/lib/env.server";
import { sofiaToday } from "@/lib/review-format";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const THROTTLE_KIND = "assistant";
/** Най-много толкова въпроса към помощника за една минута от един човек. */
export const LOOKUPS_PER_MINUTE = 30;

/**
 * Пази от наводняване със заявки. Ползва таблицата request_throttle (както
 * публичните форми): записва се само хеш на потребителя и час – не и
 * въпросът. Паметта на сървъра не става за това: при serverless всяка
 * заявка може да попадне на различен екземпляр.
 *
 * При грешка в базата заявката се пропуска: търсенето само чете, а AI
 * режимът има отделен дневен лимит.
 */
export async function allowAssistantRequest(userId: string): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const keyHash = createHmac("sha256", serverEnv.SUPABASE_SECRET_KEY)
      .update(`assistant:${userId}`)
      .digest("hex");
    const minuteAgo = new Date(Date.now() - 60_000).toISOString();
    const { count, error } = await admin
      .from("request_throttle")
      .select("id", { count: "exact", head: true })
      .eq("kind", THROTTLE_KIND)
      .eq("key_hash", keyHash)
      .gte("created_at", minuteAgo);
    if (error) return true;
    if ((count ?? 0) >= LOOKUPS_PER_MINUTE) return false;

    await Promise.all([
      admin
        .from("request_throttle")
        .insert({ kind: THROTTLE_KIND, key_hash: keyHash }),
      // старите записи на този потребител не са нужни след няколко минути
      admin
        .from("request_throttle")
        .delete()
        .eq("kind", THROTTLE_KIND)
        .eq("key_hash", keyHash)
        .lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString()),
    ]);
    return true;
  } catch {
    return true;
  }
}

/**
 * Колко AI въпроса е задал потребителят днес. Чете се от негово име – RLS
 * връща само неговия ред. Вика се само когато AI услугата е включена.
 */
export async function getAiUsedToday(userId: string): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_usage")
    .select("requests")
    .eq("user_id", userId)
    .eq("day", sofiaToday())
    .maybeSingle();
  return data?.requests ?? 0;
}

/**
 * Отброява един AI въпрос, ако потребителят е под дневния лимит. Вика се
 * чак след като услугата е приела заявката – отказана заявка не се брои.
 */
export async function consumeAiRequest(
  userId: string,
  limit: number,
): Promise<{ allowed: boolean; used: number } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_ai_request", {
    p_user: userId,
    p_limit: limit,
  });
  const row = data?.[0];
  if (error || !row) return null;
  return { allowed: row.allowed, used: row.used };
}

// Един въпрос наведнъж на потребител: безплатните планове на AI услугите
// имат тесни лимити. Пази се в паметта на този екземпляр на сървъра – спира
// двойното натискане и отворените няколко раздела; дневният лимит в базата
// остава истинската граница.
const inFlight = new Set<string>();

export function beginAnswer(userId: string): boolean {
  if (inFlight.has(userId)) return false;
  inFlight.add(userId);
  return true;
}

export function endAnswer(userId: string): void {
  inFlight.delete(userId);
}
