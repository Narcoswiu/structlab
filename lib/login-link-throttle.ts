import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const PER_EMAIL_PER_HOUR = 3;
const MIN_SECONDS_BETWEEN = 60;
/** Таван за целия сайт – пази дневния лимит на пощенския ни акаунт. */
const GLOBAL_PER_HOUR = 40;

/**
 * Решава дали може да се изпрати още един линк до този адрес и ако да –
 * го записва. Връща false, когато лимитът е стигнат.
 */
export async function allowLoginLink(email: string): Promise<boolean> {
  const admin = createAdminClient();
  const emailHash = createHash("sha256").update(email).digest("hex");
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const [mine, everyone] = await Promise.all([
    admin
      .from("login_link_requests")
      .select("created_at")
      .eq("email_hash", emailHash)
      .gte("created_at", hourAgo)
      .order("created_at", { ascending: false }),
    admin
      .from("login_link_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", hourAgo),
  ]);
  // При грешка в базата предпочитаме да не пращаме, отколкото да пращаме без лимит.
  if (mine.error || everyone.error) return false;

  const recent = mine.data ?? [];
  const latest = recent[0]?.created_at;
  const tooSoon =
    latest !== undefined &&
    Date.now() - new Date(latest).getTime() < MIN_SECONDS_BETWEEN * 1000;
  if (
    tooSoon ||
    recent.length >= PER_EMAIL_PER_HOUR ||
    (everyone.count ?? 0) >= GLOBAL_PER_HOUR
  ) {
    return false;
  }

  const { error } = await admin
    .from("login_link_requests")
    .insert({ email_hash: emailHash });
  if (error) return false;

  // почистване: записи по-стари от денонощие не ни трябват
  await admin
    .from("login_link_requests")
    .delete()
    .lt("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return true;
}
