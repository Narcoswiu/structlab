import { DAY_MS, HOUR_MS, sofiaMoment } from "./helpers";

/**
 * Правилата за напомнянията: кой какво писмо получава и кога.
 * Чиста функция – без база и без мрежа, за да се тества изцяло.
 */

export type ReminderKind = "review_due" | "continue" | "weekly";

export type ReminderFacts = {
  /** личният ключ на потребителя („Профил“ или линкът в писмото) */
  remindersEnabled: boolean;
  hasActiveAccess: boolean;
  emailConfirmed: boolean;
  /** последното изпратено напомняне от който и да е вид; ISO или null */
  lastEmailAt: string | null;
  /** последната активност в платформата; ISO или null */
  lastActivityAt: string | null;
  /** кога е създаден акаунтът; ISO */
  createdAt: string;
  /** въпроси за повторение днес (вкл. закъснелите) */
  dueCount: number;
  /** от колко дни чака най-старият от тях */
  oldestDueDays: number;
  /** имал ли е активност днес (по българско време) */
  activeToday: boolean;
  /** започната, но недовършена глава; null, ако няма */
  resume: { sectionsSeen: number; sectionsTotal: number } | null;
  /** писма „Продължи“ след последната активност */
  continueEmailsSinceLastActivity: number;
  weeklyAlreadySentThisWeek: boolean;
};

export type ReminderDecision =
  { kind: ReminderKind; reason: string } | { kind: null; reason: string };

/** без писма от този час … */
export const QUIET_FROM_HOUR = 21;
/** … до този час (по българско време) */
export const QUIET_UNTIL_HOUR = 8;
/** най-много едно напомняне на толкова часа */
export const MIN_HOURS_BETWEEN_EMAILS = 72;
/** новият акаунт не получава напомняния толкова дни */
export const NEW_ACCOUNT_DAYS = 2;
/** седмичният отчет е само за хора с активност в последните толкова дни */
export const WEEKLY_ACTIVE_DAYS = 28;
/** „Продължи“ тръгва след толкова дни без активност */
export const INACTIVE_DAYS = 5;
/** най-много толкова писма „Продължи“ без активност между тях */
export const MAX_CONTINUE_EMAILS = 2;

const no = (reason: string): ReminderDecision => ({ kind: null, reason });

export function decideReminder(
  facts: ReminderFacts,
  now: Date,
): ReminderDecision {
  if (!facts.remindersEnabled) return no("изключил е напомнянията");
  if (!facts.hasActiveAccess) return no("няма активен достъп");
  if (!facts.emailConfirmed) return no("имейлът не е потвърден");

  const nowMs = now.getTime();
  if (nowMs - Date.parse(facts.createdAt) < NEW_ACCOUNT_DAYS * DAY_MS) {
    return no("акаунтът е на по-малко от 2 дни");
  }

  const at = sofiaMoment(now);
  if (at.hour >= QUIET_FROM_HOUR || at.hour < QUIET_UNTIL_HOUR) {
    return no("тихи часове (21:00–08:00)");
  }

  if (
    facts.lastEmailAt &&
    nowMs - Date.parse(facts.lastEmailAt) < MIN_HOURS_BETWEEN_EMAILS * HOUR_MS
  ) {
    return no("получил е писмо през последните 3 дни");
  }

  const sinceActivity = facts.lastActivityAt
    ? nowMs - Date.parse(facts.lastActivityAt)
    : null;

  // (а) седмичен отчет – в понеделник
  if (
    at.weekday === 0 &&
    !facts.weeklyAlreadySentThisWeek &&
    sinceActivity !== null &&
    sinceActivity <= WEEKLY_ACTIVE_DAYS * DAY_MS
  ) {
    return {
      kind: "weekly",
      reason: "понеделник е и е учил през последните 28 дни",
    };
  }

  // (б) въпроси за повторение
  const enoughDue =
    facts.dueCount >= 3 || (facts.dueCount >= 1 && facts.oldestDueDays >= 2);
  if (enoughDue) {
    if (!facts.activeToday) {
      return {
        kind: "review_due",
        reason:
          facts.dueCount >= 3
            ? `${facts.dueCount} въпроса чакат повторение`
            : `въпрос чака повторение от ${facts.oldestDueDays} дни`,
      };
    }
    // днес вече учи – не го прекъсваме; „Продължи“ също не важи
    return no("има въпроси за повторение, но днес вече е учил");
  }

  // (в) недовършена глава след 5 дни без активност
  if (sinceActivity !== null && sinceActivity >= INACTIVE_DAYS * DAY_MS) {
    const unfinished =
      facts.resume !== null &&
      facts.resume.sectionsSeen < facts.resume.sectionsTotal;
    if (!unfinished) return no("няма го от 5+ дни, но няма недовършена глава");
    if (facts.continueEmailsSinceLastActivity >= MAX_CONTINUE_EMAILS) {
      return no("вече получи 2 писма „Продължи“ без активност – оставяме го");
    }
    return {
      kind: "continue",
      reason: `няма го от ${Math.floor(sinceActivity / DAY_MS)} дни и има недовършена глава`,
    };
  }

  return no("няма повод за писмо");
}
