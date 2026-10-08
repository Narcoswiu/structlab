import "server-only";
import { cache } from "react";
import {
  TASK_LIST,
  isVariant,
  type PersonalTask,
  type Variant,
} from "@/lib/personal-tasks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Вариантът на влезлия потребител (RLS връща само неговия ред). */
export const getVariant = cache(
  async (userId: string): Promise<Variant | null> => {
    const supabase = await createClient();
    const { data } = await supabase
      .from("task_variants")
      .select("a, b, c")
      .eq("user_id", userId)
      .maybeSingle();
    return data && isVariant(data) ? data : null;
  },
);

export type TaskState = {
  /** последно въведените числа по id на въпроса */
  answers: Record<string, number>;
  /** кои от тях са верни */
  results: Record<string, boolean>;
  attempts: number;
  solvedAt: string | null;
  lastCheckedAt: string;
};

function toRecord<T>(value: unknown, isT: (item: unknown) => item is T) {
  const out: Record<string, T> = {};
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) {
      if (isT(item)) out[key] = item;
    }
  }
  return out;
}
const isNumber = (item: unknown): item is number =>
  typeof item === "number" && Number.isFinite(item);
const isBoolean = (item: unknown): item is boolean => typeof item === "boolean";

/** Състоянието на всички задания на потребителя, по име на заданието. */
export async function getTaskStates(
  userId: string,
): Promise<Map<string, TaskState>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("personal_tasks")
    .select("template, answers, results, attempts, solved_at, last_checked_at")
    .eq("user_id", userId);
  return new Map(
    (data ?? []).map((row) => [
      row.template,
      {
        answers: toRecord(row.answers, isNumber),
        results: toRecord(row.results, isBoolean),
        attempts: row.attempts,
        solvedAt: row.solved_at,
        lastCheckedAt: row.last_checked_at,
      },
    ]),
  );
}

export type TasksSummary = { total: number; solved: number; started: number };

export async function getTasksSummary(userId: string): Promise<TasksSummary> {
  const states = await getTaskStates(userId);
  const known = TASK_LIST.map((task) => states.get(task.slug)).filter(Boolean);
  return {
    total: TASK_LIST.length,
    solved: known.filter((state) => state!.solvedAt).length,
    started: known.length,
  };
}

/**
 * Записва варианта. Ако се различава от досегашния, отговорите по всички
 * задания се изтриват – числата в задачите вече са други.
 * Вика се само от сървъра, след като е проверено кой е потребителят.
 */
export async function saveVariant(
  userId: string,
  variant: Variant,
): Promise<"saved" | "unchanged" | "error"> {
  const admin = createAdminClient();
  const { data: current } = await admin
    .from("task_variants")
    .select("a, b, c")
    .eq("user_id", userId)
    .maybeSingle();
  if (
    current &&
    current.a === variant.a &&
    current.b === variant.b &&
    current.c === variant.c
  ) {
    return "unchanged";
  }
  if (current) {
    const removed = await admin
      .from("personal_tasks")
      .delete()
      .eq("user_id", userId);
    if (removed.error) return "error";
  }
  const { error } = await admin.from("task_variants").upsert({
    user_id: userId,
    a: variant.a,
    b: variant.b,
    c: variant.c,
    created_at: new Date().toISOString(),
  });
  return error ? "error" : "saved";
}

/** Записва една проверка на отговорите. */
export async function saveCheck(
  userId: string,
  task: PersonalTask,
  answers: Record<string, number>,
  results: Record<string, boolean>,
  previous: TaskState | undefined,
): Promise<boolean> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const allCorrect = task.questions.every((question) => results[question.id]);
  const { error } = await admin.from("personal_tasks").upsert({
    user_id: userId,
    template: task.slug,
    answers,
    results,
    attempts: (previous?.attempts ?? 0) + 1,
    // веднъж решена, задачата остава решена
    solved_at: previous?.solvedAt ?? (allCorrect ? now : null),
    last_checked_at: now,
    ...(previous ? {} : { first_checked_at: now }),
  });
  return !error;
}
