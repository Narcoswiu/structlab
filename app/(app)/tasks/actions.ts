"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasActiveAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import type { FormState } from "@/lib/form-state";
import { parseDecimal } from "@/lib/number-input";
import {
  buildTask,
  checkAnswers,
  variantFromFacultyNumber,
} from "@/lib/personal-tasks";
import { getTaskStates, getVariant, saveCheck, saveVariant } from "@/lib/tasks";

/**
 * Приема факултетния номер, взема от него само последните три цифри и
 * записва тях. Самият номер не се пази и не се връща обратно към формата.
 */
export async function setFacultyNumber(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (!(await hasActiveAccess(user))) {
    return { error: "Нямаш активен достъп." };
  }
  const raw = String(formData.get("facultyNumber") ?? "").slice(0, 40);
  const variant = variantFromFacultyNumber(raw);
  if (!variant) {
    return {
      fieldErrors: {
        facultyNumber: "Въведи факултетния си номер – поне 4 цифри.",
      },
    };
  }
  const outcome = await saveVariant(user.id, variant);
  if (outcome === "error") {
    return { error: "Не успяхме да запишем варианта. Опитай пак." };
  }
  revalidatePath("/tasks", "layout");
  revalidatePath("/dashboard");
  return {
    success:
      outcome === "unchanged"
        ? "Вариантът е същият – заданията ти не се променят."
        : "Готово – заданията са с твоите числа.",
  };
}

export type TaskCheckState = {
  /** имало ли е проверка в този отговор на сървъра */
  checked: boolean;
  error?: string;
  /** въведеният текст по id на въпроса – връща се, за да не се изтрие */
  values: Record<string, string>;
  fieldErrors: Record<string, string>;
  results: Record<string, boolean>;
  solved: boolean;
};

const slugSchema = z.string().regex(/^[a-z0-9-]{1,60}$/);

/**
 * Най-малко време между две проверки на една задача – срещу налучкване с
 * много бързи заявки. Човек, който поправя число, винаги е по-бавен.
 */
const MIN_SECONDS_BETWEEN_CHECKS = 2;

export async function checkTask(
  prev: TaskCheckState,
  formData: FormData,
): Promise<TaskCheckState> {
  const user = await requireUser();
  const fail = (error: string): TaskCheckState => ({
    ...prev,
    checked: false,
    error,
    fieldErrors: {},
  });
  if (!(await hasActiveAccess(user))) return fail("Нямаш активен достъп.");

  const slug = slugSchema.safeParse(formData.get("task"));
  const variant = await getVariant(user.id);
  const task = slug.success && variant ? buildTask(slug.data, variant) : null;
  if (!task) return fail("Заданието не е намерено. Презареди страницата.");

  const values: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  const answers: Record<string, number> = {};
  for (const question of task.questions) {
    const text = String(formData.get(`answer_${question.id}`) ?? "")
      .trim()
      .slice(0, 30);
    values[question.id] = text;
    if (text === "") continue;
    const value = parseDecimal(text);
    if (value === null) {
      fieldErrors[question.id] = "Въведи число, например 12,5.";
    } else {
      answers[question.id] = value;
    }
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { ...prev, checked: false, error: undefined, values, fieldErrors };
  }
  if (Object.keys(answers).length === 0) {
    return {
      ...prev,
      checked: false,
      values,
      fieldErrors: {},
      error: "Въведи поне един отговор.",
    };
  }

  const previous = (await getTaskStates(user.id)).get(task.slug);
  if (
    previous &&
    Date.now() - new Date(previous.lastCheckedAt).getTime() <
      MIN_SECONDS_BETWEEN_CHECKS * 1000
  ) {
    return {
      ...prev,
      checked: false,
      values,
      fieldErrors: {},
      error: "Изчакай няколко секунди преди следващата проверка.",
    };
  }

  const results = checkAnswers(task, answers);
  if (!(await saveCheck(user.id, task, answers, results, previous))) {
    return {
      ...prev,
      checked: false,
      values,
      fieldErrors: {},
      error: "Проверката не се записа. Опитай пак.",
    };
  }
  revalidatePath("/tasks", "layout");
  revalidatePath("/dashboard");
  return {
    checked: true,
    values,
    fieldErrors: {},
    results,
    solved:
      Boolean(previous?.solvedAt) ||
      task.questions.every((question) => results[question.id]),
  };
}
