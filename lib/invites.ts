import { createHash, randomBytes } from "node:crypto";

/** Случаен код за покана (256 бита), безопасен за адрес. */
export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

/** В базата пазим само хеша – изтекла база не издава работещи линкове. */
export function hashInviteToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function isValidInviteTokenFormat(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export function getInviteStatus(
  invite: {
    accepted_at: string | null;
    revoked_at: string | null;
    expires_at: string;
  },
  now: Date = new Date(),
): InviteStatus {
  if (invite.accepted_at) return "accepted";
  if (invite.revoked_at) return "revoked";
  if (new Date(invite.expires_at) <= now) return "expired";
  return "pending";
}

/** Дата „без край“ за планове без срок (виж миграцията lifetime_plan). */
export const LIFETIME_EXPIRY = new Date("2999-12-31T00:00:00.000Z");

/** Край на достъпа според плана: безсрочен или начало + броя дни. */
export function computePlanExpiry(
  start: Date,
  plan: { duration_days: number; is_lifetime: boolean },
): Date {
  return plan.is_lifetime
    ? LIFETIME_EXPIRY
    : computeAccessExpiry(start, plan.duration_days);
}

/** „14 дни“ или „без срок“ – за показване в интерфейса. */
export function describePlanDuration(plan: {
  duration_days: number;
  is_lifetime: boolean;
}): string {
  return plan.is_lifetime ? "без срок" : `${plan.duration_days} дни`;
}

/** Край на достъпа: от началото + броя дни. */
export function computeAccessExpiry(start: Date, durationDays: number): Date {
  return new Date(start.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

/** Имейли от текстово поле: по един на ред или разделени със запетая. */
export function parseEmailList(input: string): {
  valid: string[];
  invalid: string[];
} {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of input.split(/[\s,;]+/)) {
    const email = raw.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }
  return { valid, invalid };
}
