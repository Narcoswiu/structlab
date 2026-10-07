"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { InviteEmail } from "@/emails/InviteEmail";
import { requireAdmin } from "@/lib/auth";
import {
  getContactEmail,
  isEmailConfigured,
  sendEmail,
} from "@/lib/email/send";
import { formatDate } from "@/lib/format-date";
import type { FormState } from "@/lib/form-state";
import {
  computeAccessExpiry,
  generateInviteToken,
  hashInviteToken,
  parseEmailList,
} from "@/lib/invites";
import { absoluteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

// Всяко действие тук започва с requireAdmin(). Записите минават през клиента
// на влезлия admin, така че и RLS в базата проверява ролята втори път.

const INVITE_VALID_DAYS = 14;
const MAX_INVITES_PER_SUBMIT = 20;

export type InviteResult = {
  email: string;
  url?: string;
  emailed: boolean;
  error?: string;
};

export type InviteFormState = FormState & { results?: InviteResult[] };

type Plan = {
  id: string;
  name: string;
  duration_days: number;
  is_lifetime: boolean;
};

async function deliverInvite(
  invite: { email: string; fullName: string; token: string; expiresAt: Date },
  plan: Plan,
  sendNow: boolean,
): Promise<InviteResult> {
  const url = absoluteUrl(`/invite/${invite.token}`);
  if (!sendNow) return { email: invite.email, url, emailed: false };

  try {
    await sendEmail({
      to: invite.email,
      subject: plan.is_lifetime
        ? "Покана за StructLab – пълен безплатен достъп"
        : `Покана за StructLab – ${plan.duration_days} дни пълен достъп`,
      template: InviteEmail({
        fullName: invite.fullName,
        inviteUrl: url,
        planName: plan.name,
        durationDays: plan.is_lifetime ? null : plan.duration_days,
        inviteExpiresOn: formatDate(invite.expiresAt),
        contactEmail: getContactEmail(),
      }),
    });
    return { email: invite.email, url, emailed: true };
  } catch {
    return {
      email: invite.email,
      url,
      emailed: false,
      error: "Имейлът не тръгна – изпрати линка ръчно.",
    };
  }
}

const createSchema = z.object({
  emails: z.string().max(5000),
  fullName: z.string().trim().max(120),
  planId: z.uuid(),
  sendNow: z.boolean(),
});

export async function createInvites(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const admin = await requireAdmin();
  const values = {
    emails: String(formData.get("emails") ?? ""),
    fullName: String(formData.get("fullName") ?? ""),
  };
  const parsed = createSchema.safeParse({
    ...values,
    planId: formData.get("planId"),
    sendNow: formData.get("sendNow") === "on",
  });
  if (!parsed.success) {
    return { values, error: "Провери полетата и опитай пак." };
  }

  const { valid, invalid } = parseEmailList(parsed.data.emails);
  if (invalid.length > 0) {
    return { values, error: `Невалидни адреси: ${invalid.join(", ")}` };
  }
  if (valid.length === 0) return { values, error: "Въведи поне един имейл." };
  if (valid.length > MAX_INVITES_PER_SUBMIT) {
    return {
      values,
      error: `Най-много ${MAX_INVITES_PER_SUBMIT} покани наведнъж.`,
    };
  }
  const sendNow = parsed.data.sendNow;
  if (sendNow && !isEmailConfigured()) {
    return {
      values,
      error: "Пощата не е настроена – махни отметката и копирай линковете.",
    };
  }

  const supabase = await createClient();
  const { data: plan } = await supabase
    .from("access_plans")
    .select("id, name, duration_days, is_lifetime")
    .eq("id", parsed.data.planId)
    .single();
  if (!plan) return { values, error: "Избраният план не съществува." };

  const now = new Date();
  const expiresAt = computeAccessExpiry(now, INVITE_VALID_DAYS);
  const fullName = valid.length === 1 ? parsed.data.fullName : "";
  const results: InviteResult[] = [];

  for (const email of valid) {
    // Стара неприета покана за същия адрес се отменя, за да важи само новата.
    await supabase
      .from("invites")
      .update({ revoked_at: now.toISOString() })
      .eq("email", email)
      .is("accepted_at", null)
      .is("revoked_at", null);

    const token = generateInviteToken();
    const { data: row, error } = await supabase
      .from("invites")
      .insert({
        email,
        full_name: fullName,
        plan_id: plan.id,
        token_hash: hashInviteToken(token),
        invited_by: admin.id,
        expires_at: expiresAt.toISOString(),
      })
      .select("id")
      .single();
    if (error || !row) {
      results.push({ email, emailed: false, error: "Поканата не се записа." });
      continue;
    }

    const result = await deliverInvite(
      { email, fullName, token, expiresAt },
      plan,
      sendNow,
    );
    if (result.emailed) {
      await supabase
        .from("invites")
        .update({ email_sent_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    results.push(result);
  }

  revalidatePath("/admin");
  return { results };
}

const renewSchema = z.object({ inviteId: z.uuid(), sendNow: z.boolean() });

/** Нов линк за съществуваща покана (старият спира да работи). */
export async function renewInvite(
  _prev: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  await requireAdmin();
  const parsed = renewSchema.safeParse({
    inviteId: formData.get("inviteId"),
    sendNow: formData.get("sendNow") === "on",
  });
  if (!parsed.success) return { error: "Невалидна покана." };
  if (parsed.data.sendNow && !isEmailConfigured()) {
    return { error: "Пощата не е настроена." };
  }

  const supabase = await createClient();
  const token = generateInviteToken();
  const expiresAt = computeAccessExpiry(new Date(), INVITE_VALID_DAYS);
  const { data: invite } = await supabase
    .from("invites")
    .update({
      token_hash: hashInviteToken(token),
      expires_at: expiresAt.toISOString(),
      revoked_at: null,
    })
    .eq("id", parsed.data.inviteId)
    .is("accepted_at", null)
    .select(
      "id, email, full_name, access_plans(id, name, duration_days, is_lifetime)",
    )
    .maybeSingle();
  if (!invite?.access_plans) {
    return { error: "Поканата вече е приета или не съществува." };
  }

  const result = await deliverInvite(
    { email: invite.email, fullName: invite.full_name, token, expiresAt },
    invite.access_plans,
    parsed.data.sendNow,
  );
  if (result.emailed) {
    await supabase
      .from("invites")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  revalidatePath("/admin");
  return { results: [result] };
}

export async function revokeInvite(formData: FormData): Promise<void> {
  await requireAdmin();
  const inviteId = z.uuid().safeParse(formData.get("inviteId"));
  if (!inviteId.success) return;

  const supabase = await createClient();
  await supabase
    .from("invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", inviteId.data)
    .is("accepted_at", null);
  revalidatePath("/admin");
}

const planSchema = z.object({
  planId: z.uuid(),
  durationDays: z.coerce.number().int().min(1).max(3660),
});

export async function updatePlanDuration(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = planSchema.safeParse({
    planId: formData.get("planId"),
    durationDays: formData.get("durationDays"),
  });
  if (!parsed.success) return { error: "Въведи цяло число между 1 и 3660." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("access_plans")
    .update({ duration_days: parsed.data.durationDays })
    .eq("id", parsed.data.planId);
  if (error) return { error: "Срокът не беше записан." };

  revalidatePath("/admin");
  return { success: "Записано. Важи за поканите, приети оттук нататък." };
}

const enrollmentSchema = z.object({
  enrollmentId: z.uuid(),
  intent: z.enum(["revoke", "restore", "extend"]),
});

export async function changeEnrollment(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = enrollmentSchema.safeParse({
    enrollmentId: formData.get("enrollmentId"),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return;
  const { enrollmentId, intent } = parsed.data;
  const supabase = await createClient();

  if (intent === "revoke") {
    await supabase
      .from("enrollments")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", enrollmentId);
  } else if (intent === "restore") {
    await supabase
      .from("enrollments")
      .update({ revoked_at: null })
      .eq("id", enrollmentId);
  } else {
    const { data } = await supabase
      .from("enrollments")
      .select("expires_at, access_plans(duration_days, is_lifetime)")
      .eq("id", enrollmentId)
      .single();
    if (data?.access_plans && !data.access_plans.is_lifetime) {
      // Удължаваме от по-късното от „сега“ и текущия край.
      const base = new Date(
        Math.max(Date.now(), new Date(data.expires_at).getTime()),
      );
      await supabase
        .from("enrollments")
        .update({
          expires_at: computeAccessExpiry(
            base,
            data.access_plans.duration_days,
          ).toISOString(),
        })
        .eq("id", enrollmentId);
    }
  }
  revalidatePath("/admin");
}
