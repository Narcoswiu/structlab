import "server-only";
import { cache } from "react";
import type { CurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/**
 * Има ли потребителят активен достъп до поне един модул. RLS връща модули
 * само при активен план; администраторът има достъп винаги.
 */
export const hasActiveAccess = cache(
  async (user: CurrentUser): Promise<boolean> => {
    if (user.role === "admin") return true;
    const supabase = await createClient();
    const { count } = await supabase
      .from("modules")
      .select("id", { count: "exact", head: true });
    return (count ?? 0) > 0;
  },
);
