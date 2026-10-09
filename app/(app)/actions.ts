"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { recordQuizAnswer } from "@/lib/review";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const introIdSchema = z.string().regex(/^[a-z0-9-]{1,40}$/);

/** „Разбрах“: помни в базата, че този екран вече е обяснен. */
export async function dismissIntro(id: string): Promise<void> {
  const parsedId = introIdSchema.safeParse(id);
  if (!parsedId.success) return;
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("user_settings")
    .select("intro_dismissed")
    .eq("user_id", user.id)
    .single();
  const current =
    data?.intro_dismissed &&
    typeof data.intro_dismissed === "object" &&
    !Array.isArray(data.intro_dismissed)
      ? data.intro_dismissed
      : {};

  await supabase
    .from("user_settings")
    .update({ intro_dismissed: { ...current, [parsedId.data]: true } })
    .eq("user_id", user.id);
}

const feedbackSchema = z.object({
  page: z.string().max(300),
  message: z
    .string()
    .trim()
    .min(3, "Напиши поне няколко думи.")
    .max(4000, "Съобщението е твърде дълго."),
});

export async function sendFeedback(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = feedbackSchema.safeParse({
    page: String(formData.get("page") ?? ""),
    message: String(formData.get("message") ?? ""),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Невалидно съобщение." };
  }

  const supabase = await createClient();
  // user_id се попълва от базата (default auth.uid()), а RLS го проверява.
  const { error } = await supabase.from("feedback").insert(parsed.data);
  if (error) return { error: "Не успяхме да запишем съобщението. Опитай пак." };
  return { success: "Благодарим! Получихме съобщението ти." };
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "Паролата трябва да е поне 10 знака.")
      .max(200),
    passwordAgain: z.string(),
  })
  .refine((value) => value.password === value.passwordAgain, {
    path: ["passwordAgain"],
    message: "Двете пароли не съвпадат.",
  });

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    passwordAgain: formData.get("passwordAgain"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      fieldErrors[String(issue.path[0])] ??= issue.message;
    }
    return { fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return { error: "Паролата не беше сменена. Избери друга и опитай пак." };
  }
  return { success: "Паролата е сменена." };
}

const specialtySchema = z.uuid();

/** Потребителят избира (или сменя) специалността си. */
export async function chooseSpecialty(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = specialtySchema.safeParse(formData.get("specialtyId"));
  if (!parsed.success) return { error: "Избери специалност от списъка." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ specialty_id: parsed.data })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  // външният ключ в базата отхвърля несъществуваща специалност
  if (error || !data) return { error: "Специалността не беше записана." };

  revalidatePath("/dashboard");
  revalidatePath("/account");
  return { success: "Специалността е записана." };
}

/**
 * Потребителят потвърждава известието за проследяването. Записва се кога.
 * Колоната не може да се променя от клиента, затова записът е със secret key –
 * но само за собствения ред на влезлия потребител.
 */
export async function acceptTrackingNotice(): Promise<void> {
  const user = await requireUser();
  const admin = createAdminClient();
  await admin
    .from("user_settings")
    .update({ tracking_notice_accepted_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("tracking_notice_accepted_at", null);
  revalidatePath("/", "layout");
}

const quizAnswerSchema = z.object({
  questionId: z.uuid(),
  knew: z.boolean(),
});

export type QuizAnswerOutcome =
  | { status: "ok"; box: number; dueOn: string | null; knew: boolean }
  | { status: "limited" | "error" | "not-found" };

/** „Знаех го“ / „Не го знаех“: записва отговора и насрочва повторението. */
export async function answerQuiz(
  questionId: string,
  knew: boolean,
): Promise<QuizAnswerOutcome> {
  const parsed = quizAnswerSchema.safeParse({ questionId, knew });
  if (!parsed.success) return { status: "error" };
  const user = await requireUser();

  // Въпросът се търси от името на потребителя: RLS го връща само ако той има
  // достъп до главата.
  const supabase = await createClient();
  const { data: question } = await supabase
    .from("quiz_questions")
    .select("id")
    .eq("id", parsed.data.questionId)
    .maybeSingle();
  if (!question) return { status: "not-found" };

  const result = await recordQuizAnswer(user.id, question.id, parsed.data.knew);
  if (result.status !== "ok") return result;
  revalidatePath("/dashboard");
  revalidatePath("/review");
  return { ...result, knew: parsed.data.knew };
}

/**
 * Ключът „Напомняния по имейл“ в профила. Записът е с клиента на самия
 * потребител: RLS и правата по колони пускат само собствения му ред.
 */
export async function setReminders(formData: FormData): Promise<void> {
  const user = await requireUser();
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  await supabase
    .from("user_settings")
    .update({ reminders_enabled: enabled })
    .eq("user_id", user.id);
  revalidatePath("/account");
}
