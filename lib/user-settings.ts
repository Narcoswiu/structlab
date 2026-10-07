import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** Кои карета „Какво е тази страница“ е скрил влезлият потребител. */
export const getDismissedIntros = cache(async (): Promise<Set<string>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("intro_dismissed")
    .maybeSingle();

  const raw = data?.intro_dismissed;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return new Set();
  return new Set(Object.keys(raw).filter((key) => raw[key] === true));
});
