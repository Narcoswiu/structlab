"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/lib/form-state";
import {
  computePlanExpiry,
  getInviteStatus,
  hashInviteToken,
  isValidInviteTokenFormat,
} from "@/lib/invites";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const acceptSchema = z
  .object({
    token: z.string().refine(isValidInviteTokenFormat),
    fullName: z.string().trim().min(2, "Въведи името си.").max(120),
    password: z
      .string()
      .min(10, "Паролата трябва да е поне 10 знака.")
      .max(200),
    passwordAgain: z.string(),
    terms: z.literal("on", { error: "Трябва да приемеш условията." }),
  })
  .refine((value) => value.password === value.passwordAgain, {
    path: ["passwordAgain"],
    message: "Двете пароли не съвпадат.",
  });

const INVALID = "Поканата е невалидна, изтекла или вече е използвана.";

export async function acceptInvite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
    terms: formData.get("terms"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "");
      if (key === "token") return { error: INVALID };
      fieldErrors[key] ??= issue.message;
    }
    return {
      fieldErrors,
      values: { fullName: String(formData.get("fullName") ?? "") },
    };
  }
  const { token, fullName, password } = parsed.data;
  const values = { fullName };

  // Посетителят още няма акаунт, затова работим със secret key на сървъра.
  const admin = createAdminClient();
  const { data: invite } = await admin
    .from("invites")
    .select("id, email, plan_id, accepted_at, revoked_at, expires_at")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!invite || getInviteStatus(invite) !== "pending")
    return { error: INVALID };

  const { data: plan } = await admin
    .from("access_plans")
    .select("id, duration_days, is_beta, is_lifetime")
    .eq("id", invite.plan_id)
    .single();
  if (!plan) return { error: INVALID };

  // 1) Заемаме поканата. Условието „accepted_at is null“ гарантира, че при две
  //    едновременни заявки само едната ще успее.
  const now = new Date();
  const { data: claimed } = await admin
    .from("invites")
    .update({ accepted_at: now.toISOString() })
    .eq("id", invite.id)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { error: INVALID };

  const release = () =>
    admin.from("invites").update({ accepted_at: null }).eq("id", invite.id);

  // 2) Създаваме акаунта. Имейлът е потвърден: линкът е стигнал до тази поща.
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
  if (createError || !created.user) {
    await release();
    const exists = createError?.code === "email_exists";
    return {
      values,
      error: exists
        ? "С този имейл вече има акаунт. Влез от страницата „Вход“."
        : "Акаунтът не можа да се създаде. Опитай пак или избери друга парола.",
    };
  }
  const userId = created.user.id;

  // 3) Достъп според плана + отбелязване на съгласието с условията.
  const { error: enrollError } = await admin.from("enrollments").insert({
    user_id: userId,
    plan_id: plan.id,
    source: plan.is_beta ? "beta" : "invite",
    starts_at: now.toISOString(),
    expires_at: computePlanExpiry(now, plan).toISOString(),
  });
  if (enrollError) {
    await admin.auth.admin.deleteUser(userId);
    await release();
    return {
      values,
      error: "Нещо се обърка при даването на достъп. Опитай пак.",
    };
  }
  await admin
    .from("user_settings")
    .update({ terms_accepted_at: now.toISOString() })
    .eq("user_id", userId);
  await admin
    .from("invites")
    .update({ accepted_by: userId })
    .eq("id", invite.id);

  // 4) Влизаме от името на новия потребител.
  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: invite.email,
    password,
  });
  redirect(signInError ? "/login" : "/dashboard");
}
