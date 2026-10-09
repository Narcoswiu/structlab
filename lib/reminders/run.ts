import "server-only";
import type { ReactElement } from "react";
import {
  ContinueEmail,
  ReviewDueEmail,
  WeeklyEmail,
  continueSubject,
  reviewDueSubject,
  weeklySubject,
} from "@/emails/ReminderEmails";
import {
  isEmailConfigured,
  sendEmail,
  type SendEmailInput,
} from "@/lib/email/send";
import { absoluteUrl } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  MIN_HOURS_BETWEEN_EMAILS,
  decideReminder,
  type ReminderKind,
} from "./decide";
import { gatherReminderCandidates, type ReminderCandidate } from "./facts";
import { HOUR_MS, errorClass, maskEmail } from "./helpers";
import { getRemindersSwitch } from "./settings";
import { unsubscribeOneClickUrl, unsubscribePageUrl } from "./unsubscribe";

/**
 * Дневното изпращане на напомнянията.
 *
 * ГЛАВНИЯТ КЛЮЧ се проверява тук, а не само в cron адреса: който и да извика
 * runReminders без dryRun, при изключен ключ не се изпраща и не се записва
 * нищо. Ключът се проверява отново преди всяко отделно писмо – ако
 * администраторът го изключи по средата, изпращането спира веднага.
 */

export type ReminderSend = (input: SendEmailInput) => Promise<unknown>;

export type ReminderRunItem = {
  userId: string;
  /** „m***@gmail.com“ – пълният адрес не напуска тази функция */
  maskedEmail: string;
  name: string;
  kind: ReminderKind | null;
  reason: string;
  /** само при истинско изпращане */
  outcome?: "sent" | "failed" | "deferred";
};

export type ReminderRunResult = {
  status: "disabled" | "not-configured" | "dry-run" | "done";
  /** колко потребители са прегледани */
  considered: number;
  items: ReminderRunItem[];
  sent: number;
  failed: number;
  /** останали за следващия ден заради тавана или времето */
  deferred: number;
};

type RunOptions = {
  now?: Date;
  /** само показва какво би тръгнало: не изпраща и не записва нищо */
  dryRun?: boolean;
  /** с какво се изпраща; по подразбиране – истинската поща (SMTP) */
  send?: ReminderSend;
  /** таван на писмата в едно пускане (Gmail има дневен лимит) */
  cap?: number;
  /** колко време най-много да работи (функцията във Vercel има краен срок) */
  budgetMs?: number;
  /** само тези потребители – за тестовете, които споделят една база */
  onlyUserIds?: string[];
};

export const DEFAULT_CAP = 200;
const DEFAULT_BUDGET_MS = 45_000;
const REMINDER_KINDS = ["review_due", "continue", "weekly", "new_chapter"];

const empty = (status: ReminderRunResult["status"]): ReminderRunResult => ({
  status,
  considered: 0,
  items: [],
  sent: 0,
  failed: 0,
  deferred: 0,
});

/** Писмото за един потребител: тема, съдържание и заглавки за отписване. */
export function buildReminderEmail(
  candidate: ReminderCandidate,
  kind: ReminderKind,
): Omit<SendEmailInput, "to"> | null {
  const common = {
    firstName: candidate.firstName,
    unsubscribeUrl: unsubscribePageUrl(candidate.unsubscribeToken),
    settingsUrl: absoluteUrl("/account"),
  };
  let subject: string;
  let template: ReactElement;
  if (kind === "review_due") {
    const props = { ...common, ...candidate.review };
    subject = reviewDueSubject(props);
    template = ReviewDueEmail(props);
  } else if (kind === "continue") {
    if (!candidate.resume) return null;
    const props = { ...common, ...candidate.resume };
    subject = continueSubject(props);
    template = ContinueEmail(props);
  } else {
    const props = { ...common, ...candidate.weekly };
    subject = weeklySubject(props);
    template = WeeklyEmail(props);
  }
  return {
    subject,
    template,
    headers: {
      "List-Unsubscribe": `<${unsubscribeOneClickUrl(candidate.unsubscribeToken)}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

export async function runReminders(
  options: RunOptions = {},
): Promise<ReminderRunResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const cap = options.cap ?? DEFAULT_CAP;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const admin = createAdminClient();

  let send = options.send;
  if (!dryRun) {
    if (!(await getRemindersSwitch(admin)).enabled) return empty("disabled");
    if (!send) {
      if (!isEmailConfigured()) return empty("not-configured");
      send = sendEmail;
    }
  }

  let candidates = await gatherReminderCandidates(admin, now);
  if (options.onlyUserIds) {
    const only = new Set(options.onlyUserIds);
    candidates = candidates.filter((candidate) => only.has(candidate.userId));
  }

  const result: ReminderRunResult = {
    ...empty(dryRun ? "dry-run" : "done"),
    considered: candidates.length,
  };
  const startedAt = Date.now();
  let stopped = false;

  for (const candidate of candidates) {
    const decision = decideReminder(candidate.facts, now);
    const item: ReminderRunItem = {
      userId: candidate.userId,
      maskedEmail: maskEmail(candidate.email),
      name: candidate.fullName,
      kind: decision.kind,
      reason: decision.reason,
    };
    result.items.push(item);
    if (dryRun || !send || decision.kind === null) continue;

    const email = buildReminderEmail(candidate, decision.kind);
    if (!email) {
      item.kind = null;
      item.reason = "липсват данни за писмото";
      continue;
    }
    if (
      stopped ||
      result.sent + result.failed >= cap ||
      Date.now() - startedAt > budgetMs
    ) {
      item.outcome = "deferred";
      result.deferred += 1;
      continue;
    }
    // ключът може да е изключен, докато върви изпращането
    if (!(await getRemindersSwitch(admin)).enabled) {
      stopped = true;
      item.outcome = "deferred";
      result.deferred += 1;
      continue;
    }

    // Първо записваме писмото в лога и чак тогава го пращаме. Ако записът не
    // стане, писмо не тръгва: иначе утре същият човек би получил второ.
    const reserved = await admin
      .from("email_log")
      .insert({
        user_id: candidate.userId,
        kind: decision.kind,
        status: "sent",
        sent_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (reserved.error || !reserved.data) {
      item.outcome = "failed";
      result.failed += 1;
      continue;
    }
    const logId = reserved.data.id;
    const markFailed = (error: string) =>
      admin
        .from("email_log")
        .update({ status: "failed", error })
        .eq("id", logId);

    // Две пускания едновременно (напр. cron, повторен от платформата): ако
    // друго вече е записало писмо за този човек, това се отказва.
    const others = await admin
      .from("email_log")
      .select("id")
      .eq("user_id", candidate.userId)
      .eq("status", "sent")
      .in("kind", REMINDER_KINDS)
      .gt(
        "sent_at",
        new Date(
          now.getTime() - MIN_HOURS_BETWEEN_EMAILS * HOUR_MS,
        ).toISOString(),
      )
      .neq("id", logId)
      .limit(1);
    if (others.error || others.data.length > 0) {
      await markFailed("DUPLICATE_RUN");
      item.outcome = "failed";
      result.failed += 1;
      continue;
    }

    try {
      await send({ to: candidate.email, ...email });
      item.outcome = "sent";
      result.sent += 1;
    } catch (error) {
      // една грешка не спира останалите; в лога влиза само класът ѝ
      await markFailed(errorClass(error));
      item.outcome = "failed";
      result.failed += 1;
    }
  }
  return result;
}
