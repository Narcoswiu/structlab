"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const settingsSchema = z
  .object({
    theme: z.enum(["light", "sepia", "dark"]),
    font_size: z.number().int().min(1).max(4),
    reader_mode: z.enum(["easy", "detailed"]),
  })
  .partial();

/** Помни темата, размера на шрифта и режима на четене в акаунта. */
export async function saveReaderSettings(input: unknown): Promise<void> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return;
  const user = await requireUser();
  const supabase = await createClient();
  await supabase
    .from("user_settings")
    .update(parsed.data)
    .eq("user_id", user.id);
}
