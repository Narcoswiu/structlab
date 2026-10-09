"use server";

import { redirect } from "next/navigation";
import { unsubscribeByToken } from "@/lib/reminders/unsubscribe";

/**
 * Бутонът „Спри напомнянията“. Без вход: кодът от линка е достатъчен.
 * След това страницата показва едно и също потвърждение за всеки код.
 */
export async function stopReminders(formData: FormData): Promise<void> {
  const token = String(formData.get("token") ?? "");
  await unsubscribeByToken(token);
  const safe = /^[0-9a-f-]{1,40}$/i.test(token) ? token : "x";
  redirect(`/unsubscribe/${safe}?done=1`);
}
