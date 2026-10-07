import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type EventType = Database["public"]["Enums"]["event_type"];

/** Видял ли е потребителят известието за проследяването (и кога). */
export const getTrackingAcceptedAt = cache(
  async (userId: string): Promise<string | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("user_settings")
      .select("tracking_notice_accepted_at")
      .eq("user_id", userId)
      .maybeSingle();
    return data?.tracking_notice_accepted_at ?? null;
  },
);

type EventDetails = {
  chapterId?: string;
  section?: string;
  mode?: "easy" | "detailed";
  lab?: string;
};

/**
 * Записва събитие от името на потребителя. Връща "limited", ако е надхвърлен
 * лимитът. Вика се само от сървъра, след като е проверено кой е потребителят
 * и че е приел известието.
 */
export async function recordEvent(
  userId: string,
  type: EventType,
  details: EventDetails = {},
): Promise<"ok" | "limited" | "error"> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_event", {
    p_user: userId,
    p_type: type,
    p_chapter: details.chapterId,
    p_section: details.section,
    p_mode: details.mode,
    p_lab: details.lab,
  });
  if (error) return "error";
  return data ? "ok" : "limited";
}

/** Записва вход – само ако известието вече е прието. Никога не спира входа. */
export async function recordLoginIfAccepted(userId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("user_settings")
      .select("tracking_notice_accepted_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (data?.tracking_notice_accepted_at) await recordEvent(userId, "login");
  } catch {
    // проследяването е второстепенно – при грешка входът продължава
  }
}
