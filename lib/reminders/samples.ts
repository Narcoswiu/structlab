import type { ReactElement } from "react";
import {
  ContinueEmail,
  NewChapterEmail,
  ReviewDueEmail,
  WeeklyEmail,
  continueSubject,
  newChapterSubject,
  reviewDueSubject,
  weeklySubject,
} from "@/emails/ReminderEmails";
import type { SampleTemplate } from "./templates";

/**
 * Примерни данни за четирите напомняния – за прегледа в браузъра и за
 * „Изпрати ми пробно писмо“ в админ панела. Нищо тук не идва от базата.
 */

type SampleOptions = {
  firstName: string;
  /** основата на линковете, напр. absoluteUrl */
  url: (path: string) => string;
};

export function sampleReminder(
  template: SampleTemplate,
  { firstName, url }: SampleOptions,
): { subject: string; element: ReactElement } {
  const common = {
    firstName,
    // примерен код – страницата за отписване го приема, без да спира нищо
    unsubscribeUrl: url("/unsubscribe/00000000-0000-4000-8000-000000000000"),
    settingsUrl: url("/account"),
  };
  const chapter = "/learn/saprotivlenie-na-materialite/razrezni-usiliya";

  if (template === "review") {
    const props = {
      ...common,
      dueCount: 7,
      masteredCount: 12,
      streakDays: 4,
      chapters: [
        { number: 1, title: "Разрезни усилия в греди", count: 3 },
        { number: 4, title: "Специално огъване", count: 4 },
      ],
      reviewUrl: url("/review"),
    };
    return { subject: reviewDueSubject(props), element: ReviewDueEmail(props) };
  }
  if (template === "continue") {
    const props = {
      ...common,
      daysAway: 6,
      chapterNumber: 5,
      chapterTitle: "Тангенциални напрежения",
      sectionTitle: "Решен пример",
      sectionsSeen: 4,
      sectionsTotal: 7,
      teaser: "Защо три залепени дъски носят повече от три незалепени?",
      continueUrl: url(`${chapter}?mode=easy#primer`),
    };
    return { subject: continueSubject(props), element: ContinueEmail(props) };
  }
  if (template === "weekly") {
    const minutes = [25, 0, 40, 15, 0, 55, 10];
    const props = {
      ...common,
      weekLabel: "29.09 – 05.10",
      days: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((label, index) => ({
        label,
        minutes: minutes[index] ?? 0,
      })),
      minutesTotal: minutes.reduce((sum, value) => sum + value, 0),
      sectionsRead: 11,
      questionsAnswered: 14,
      tasksSolved: 2,
      tasksTotal: 8,
      next: {
        label: "Повторение: 5 въпроса",
        url: url("/review"),
        note: "Отнема няколко минути и пази наученото.",
      },
    };
    return { subject: weeklySubject(props), element: WeeklyEmail(props) };
  }
  const props = {
    ...common,
    moduleTitle: "Съпротивление на материалите",
    chapterNumber: 8,
    chapterTitle: "Изкълчване на пръти",
    summary:
      "Защо тънка линийка се огъва настрани, преди да се счупи – и как да сметнеш при каква сила става това.",
    highlights: [
      "4 решени примера",
      "9 въпроса за повторение",
      "Формулата на Ойлер стъпка по стъпка",
    ],
    chapterUrl: url(chapter),
  };
  return { subject: newChapterSubject(props), element: NewChapterEmail(props) };
}
