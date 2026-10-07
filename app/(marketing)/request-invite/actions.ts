"use server";

import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import { allowPublicRequest, isHoneypotFilled } from "@/lib/public-forms";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.email("Въведи валиден имейл адрес.").max(254),
  university: z.string().trim().min(2, "Попълни университета.").max(160),
  specialty: z.string().trim().min(2, "Попълни специалността.").max(160),
  year: z.coerce.number().int().min(1, "Избери курс.").max(6),
  consent: z.literal("on", {
    error: "Трябва да се съгласиш с Политиката за поверителност.",
  }),
});

const SUCCESS =
  "Записахме те в списъка. Ще ти пишем на този имейл, когато има свободно място.";

export async function requestInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const values = {
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    university: String(formData.get("university") ?? ""),
    specialty: String(formData.get("specialty") ?? ""),
    year: String(formData.get("year") ?? ""),
  };
  // Робот, попълнил скритото поле, получава същия отговор и нищо не се записва.
  if (isHoneypotFilled(formData)) return { success: SUCCESS };

  const parsed = schema.safeParse({
    ...values,
    consent: formData.get("consent"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
    return { values, fieldErrors };
  }

  if (
    !(await allowPublicRequest("waitlist", {
      perVisitorPerHour: 5,
      globalPerHour: 200,
    }))
  ) {
    return { values, error: "Твърде много заявки. Опитай пак след малко." };
  }

  const admin = createAdminClient();
  const { email, university, specialty, year } = parsed.data;
  // Ако адресът вече е в списъка, не презаписваме и не издаваме това.
  const { error } = await admin
    .from("waitlist")
    .upsert(
      { email, university, specialty, year },
      { onConflict: "email", ignoreDuplicates: true },
    );
  if (error)
    return { values, error: "Не успяхме да запишем заявката. Опитай пак." };

  return { success: SUCCESS };
}
