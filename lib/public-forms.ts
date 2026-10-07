import "server-only";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { serverEnv } from "@/lib/env.server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Хеш на IP адреса на посетителя – за ограничаване на публичните форми.
 * Самият адрес не се записва никъде; хешът е с таен ключ и не може да се обърне.
 */
async function visitorKeyHash(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for") ?? "";
  const ip =
    forwarded.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  return createHmac("sha256", serverEnv.SUPABASE_SECRET_KEY)
    .update(ip)
    .digest("hex");
}

type Limits = {
  /** колко заявки от един посетител на час */
  perVisitorPerHour: number;
  /** таван за целия сайт на час – пази пощата и базата от наводняване */
  globalPerHour: number;
};

/**
 * Проверява лимита за публична форма и ако заявката е позволена, я записва.
 * При грешка в базата отказва – по-добре пропусната заявка, отколкото спам.
 */
export async function allowPublicRequest(
  kind: string,
  limits: Limits,
): Promise<boolean> {
  const admin = createAdminClient();
  const keyHash = await visitorKeyHash();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [mine, everyone] = await Promise.all([
    admin
      .from("request_throttle")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .eq("key_hash", keyHash)
      .gte("created_at", hourAgo),
    admin
      .from("request_throttle")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .gte("created_at", hourAgo),
  ]);
  if (mine.error || everyone.error) return false;
  if (
    (mine.count ?? 0) >= limits.perVisitorPerHour ||
    (everyone.count ?? 0) >= limits.globalPerHour
  ) {
    return false;
  }

  const { error } = await admin
    .from("request_throttle")
    .insert({ kind, key_hash: keyHash });
  if (error) return false;

  await admin
    .from("request_throttle")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return true;
}

/** Скритото поле трябва да е празно; попълва го само робот. */
export function isHoneypotFilled(formData: FormData): boolean {
  return String(formData.get("website") ?? "").trim() !== "";
}
