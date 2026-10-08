/**
 * Повторение през интервали (метод на Лайтнер): текстове и дати.
 * Чисти функции – ползват се и на сървъра, и в браузъра.
 */

/** Кутия 5 означава „научен“ – въпросът повече не се показва. */
export const MASTERED_BOX = 5;

/** След колко дни се повтаря въпрос от кутии 1–4 (същото е и в базата). */
export const REVIEW_INTERVALS = [1, 3, 7, 14] as const;

const sofiaDay = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Sofia",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Днешната дата по българско време като „2026-10-08“. */
export function sofiaToday(now: Date = new Date()): string {
  return sofiaDay.format(now);
}

/** Брой дни от една дата (ГГГГ-ММ-ДД) до друга; отрицателен, ако е назад. */
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

/** „2026-10-12“ → „12.10.“ */
export function formatDayMonth(day: string): string {
  const [, month, date] = day.split("-");
  return `${date}.${month}.`;
}

/** „утре“, „след 3 дни (на 11.10.)“, „днес“. */
export function describeDue(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn);
  if (days <= 0) return "днес";
  if (days === 1) return "утре";
  return `след ${days} дни (на ${formatDayMonth(dueOn)})`;
}

/** Изречението, което потребителят вижда, след като отбележи отговор. */
export function describeOutcome(
  outcome: { box: number; dueOn: string | null; knew: boolean },
  today: string,
): string {
  if (outcome.box >= MASTERED_BOX || outcome.dueOn === null) {
    return "Този въпрос вече е научен – няма да ти го показваме повече.";
  }
  const when = describeDue(outcome.dueOn, today);
  return outcome.knew
    ? `Отбелязано. Ще ти го покажем пак ${when}.`
    : `Няма проблем. Ще ти го покажем пак ${when}.`;
}

/** „1 въпрос“, „2 въпроса“, „5 въпроса“. */
export function questionsLabel(count: number): string {
  return count === 1 ? "1 въпрос" : `${count} въпроса`;
}
