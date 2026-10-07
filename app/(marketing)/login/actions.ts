"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { LoginLinkEmail } from "@/emails/LoginLinkEmail";
import { safeNextPath } from "@/lib/auth";
import { isEmailConfigured, sendEmail } from "@/lib/email/send";
import type { FormState } from "@/lib/form-state";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const signInSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const parsed = signInSchema.safeParse({
    email,
    password: String(formData.get("password") ?? ""),
  });
  // Едно и също съобщение за всяка грешка: не издаваме дали имейлът съществува.
  // Връщаме имейла, за да не се налага да се пише отново.
  const invalid: FormState = {
    error: "Грешен имейл или парола.",
    values: { email },
  };
  if (!parsed.success) return invalid;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return invalid;

  redirect(safeNextPath(formData.get("next")));
}

const linkSchema = z.object({
  email: z.email().max(254),
  kind: z.enum(["recovery", "magiclink"]),
});

/** Праща линк за нова парола или за вход без парола. */
export async function requestLoginLink(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = linkSchema.safeParse({
    email: String(formData.get("email") ?? "")
      .trim()
      .toLowerCase(),
    kind: formData.get("kind"),
  });
  if (!parsed.success) {
    return { fieldErrors: { email: "Въведи валиден имейл адрес." } };
  }
  if (!isEmailConfigured()) {
    return {
      error:
        "Изпращането на имейли още не е включено. Пиши на администратора за нов линк.",
    };
  }

  const { email, kind } = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.generateLink({
    type: kind,
    email,
  });

  if (!error && data.properties?.hashed_token) {
    const params = new URLSearchParams({
      token_hash: data.properties.hashed_token,
      type: kind,
    });
    try {
      await sendEmail({
        to: email,
        subject:
          kind === "recovery"
            ? "Нова парола за StructLab"
            : "Линк за вход в StructLab",
        template: LoginLinkEmail({
          kind,
          url: absoluteUrl(`/auth/confirm?${params}`),
        }),
      });
    } catch {
      return { error: "Имейлът не можа да се изпрати. Опитай пак след малко." };
    }
  }

  // Същият отговор и когато няма такъв акаунт.
  return {
    success:
      "Ако има акаунт с този имейл, изпратихме линк. Провери и папка „Спам“.",
  };
}
