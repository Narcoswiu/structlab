"use server";

import { z } from "zod";
import { ContactNotificationEmail } from "@/emails/ContactNotificationEmail";
import {
  getContactEmail,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email/send";
import type { FormState } from "@/lib/form-state";
import { allowPublicRequest, isHoneypotFilled } from "@/lib/public-forms";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().trim().min(2, "Напиши името си.").max(120),
  email: z.email("Въведи валиден имейл адрес.").max(254),
  message: z
    .string()
    .trim()
    .min(10, "Напиши поне едно изречение.")
    .max(4000, "Съобщението е твърде дълго."),
});

const SUCCESS = "Получихме съобщението ти. Ще отговорим на посочения имейл.";

export async function sendContactMessage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    message: String(formData.get("message") ?? ""),
  };
  if (isHoneypotFilled(formData)) return { success: SUCCESS };

  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
    return { values, fieldErrors };
  }

  if (
    !(await allowPublicRequest("contact", {
      perVisitorPerHour: 3,
      globalPerHour: 30,
    }))
  ) {
    return { values, error: "Твърде много съобщения. Опитай пак след малко." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("contact_messages").insert(parsed.data);
  if (error)
    return { values, error: "Не успяхме да запишем съобщението. Опитай пак." };

  // Известието е удобство: съобщението вече е записано и се вижда в админ панела,
  // затова неуспешен имейл не е грешка за посетителя.
  if (isEmailConfigured()) {
    try {
      await sendEmail({
        to: getContactEmail(),
        replyTo: parsed.data.email,
        subject: `StructLab · съобщение от ${parsed.data.name}`,
        template: ContactNotificationEmail(parsed.data),
      });
    } catch {
      // остава в админ панела
    }
  }
  return { success: SUCCESS };
}
