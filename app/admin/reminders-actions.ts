"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import type { FormState } from "@/lib/form-state";
import type { ReminderKind } from "@/lib/reminders/decide";
import {
  errorClass,
  firstName,
  sofiaLocalToDate,
} from "@/lib/reminders/helpers";
import { runReminders } from "@/lib/reminders/run";
import { sampleReminder } from "@/lib/reminders/samples";
import { isSampleTemplate } from "@/lib/reminders/templates";
import { REMINDERS_KEY } from "@/lib/reminders/settings";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Всяко действие тук започва с requireAdmin().

/**
 * Главният ключ на напомнянията. Включването иска изрична отметка. Записът
 * минава през клиента на влезлия admin – RLS проверява ролята втори път.
 */
export async function setRemindersSwitch(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const intent = formData.get("intent");
  if (intent !== "on" && intent !== "off")
    return { error: "Невалидна заявка." };
  if (intent === "on" && formData.get("confirm") !== "on") {
    return {
      error:
        "Отметни „Разбирам, че студентите ще започнат да получават писма“.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({
      value: { enabled: intent === "on" },
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
    })
    .eq("key", REMINDERS_KEY)
    .select("key");
  if (error || !data?.length) return { error: "Ключът не беше сменен." };

  revalidatePath("/admin");
  return {
    success:
      intent === "on"
        ? "Напомнянията са включени. Първите писма тръгват при следващото дневно пускане."
        : "Напомнянията са изключени. Нищо повече не тръгва към студентите.",
  };
}

/**
 * „Изпрати ми пробно писмо“: отива САМО на адреса на влезлия администратор,
 * с примерни данни. Работи и при изключен главен ключ – това е проба на
 * пощата и на вида на писмото, не напомняне към студент.
 */
export async function sendTestReminder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();
  const template = formData.get("template");
  if (!isSampleTemplate(template)) return { error: "Невалидна заявка." };
  if (!isEmailConfigured()) return { error: "Пощата не е настроена." };
  if (!admin.email) return { error: "Акаунтът ти няма имейл адрес." };

  const sample = sampleReminder(template, {
    firstName: firstName(admin.fullName),
    url: absoluteUrl,
  });
  let failure: string | null = null;
  try {
    await sendEmail({
      to: admin.email,
      subject: `[Проба] ${sample.subject}`,
      template: sample.element,
    });
  } catch (error) {
    failure = errorClass(error);
  }
  // в лога: само кой, какъв вид и кога – без адрес и без текст
  await createAdminClient()
    .from("email_log")
    .insert({
      user_id: admin.id,
      kind: "test",
      status: failure ? "failed" : "sent",
      error: failure,
    });

  revalidatePath("/admin");
  return failure
    ? {
        error: `Писмото не тръгна (${failure}). Провери настройките на пощата.`,
      }
    : { success: "Изпратено на твоя адрес. Провери и папка „Спам“." };
}

export type DryRunRow = {
  userId: string;
  name: string;
  maskedEmail: string;
  kind: ReminderKind | null;
  reason: string;
};

export type DryRunState = FormState & {
  result?: {
    considered: number;
    counts: Record<ReminderKind, number>;
    recipients: DryRunRow[];
    skipped: DryRunRow[];
  };
};

const MAX_ROWS = 200;

/**
 * „Какво би се изпратило сега“: минава през същите правила и данни като
 * дневната задача, но не изпраща и не записва нищо. Адресите са маскирани.
 */
export async function previewReminders(
  _prev: DryRunState,
  formData: FormData,
): Promise<DryRunState> {
  await requireAdmin();
  const at = String(formData.get("at") ?? "").trim();
  const now = at ? sofiaLocalToDate(at) : new Date();
  if (!now) return { error: "Невалидна дата и час.", values: { at } };

  try {
    const run = await runReminders({ dryRun: true, now });
    const rows: DryRunRow[] = run.items.map((item) => ({
      userId: item.userId,
      name: item.name,
      maskedEmail: item.maskedEmail,
      kind: item.kind,
      reason: item.reason,
    }));
    const recipients = rows.filter((row) => row.kind !== null);
    const counts: Record<ReminderKind, number> = {
      weekly: 0,
      review_due: 0,
      continue: 0,
    };
    for (const row of recipients) if (row.kind) counts[row.kind] += 1;
    return {
      values: { at },
      result: {
        considered: run.considered,
        counts,
        recipients: recipients.slice(0, MAX_ROWS),
        skipped: rows.filter((row) => row.kind === null).slice(0, MAX_ROWS),
      },
    };
  } catch {
    return { error: "Пробата не успя. Опитай пак.", values: { at } };
  }
}
