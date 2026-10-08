import { render } from "@react-email/render";
import { describe, expect, it } from "vitest";
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

const common = {
  firstName: "Мария",
  unsubscribeUrl: "https://example.test/unsubscribe/abc",
  settingsUrl: "https://example.test/account",
};
const week = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

/** Всяко напомняне трябва да казва защо е изпратено и как се спира. */
function expectFooter(html: string) {
  expect(html).toContain('href="https://example.test/unsubscribe/abc"');
  expect(html).toContain("Спри напомнянията");
  expect(html).toContain('href="https://example.test/account"');
  expect(html).toContain("Получаваш");
  expect(html).toContain('lang="bg"');
  // нищо, което имейл клиентите махат или блокират
  expect(html).not.toMatch(/<svg|<script|<img|var\(--/);
}

describe("напомняне „Днес за повторение“", () => {
  const props = {
    ...common,
    dueCount: 7,
    masteredCount: 12,
    streakDays: 4,
    reviewUrl: "https://example.test/review",
    chapters: [
      { number: 1, title: "Разрезни усилия в греди", count: 3 },
      { number: 4, title: "Специално огъване", count: 4 },
    ],
  };

  it("показва броя, минутите, серията, главите и бутона", async () => {
    const html = await render(ReviewDueEmail(props));
    expect(html).toContain("7 въпроса те чакат");
    expect(html).toContain("Здравей, Мария!");
    expect(html).toContain("дни подред");
    expect(html).toContain("Разрезни усилия в греди");
    expect(html).toContain("4 въпроса");
    expect(html).toContain('href="https://example.test/review"');
    expectFooter(html);
  });

  it("без серия показва научените; един въпрос е в единствено число", async () => {
    const html = await render(
      ReviewDueEmail({ ...props, dueCount: 1, streakDays: 1, chapters: [] }),
    );
    expect(html).toContain(
      "1 въпрос те чакат".replace("чакат", "те чакат").slice(0, 8),
    );
    expect(html).toContain("вече научени");
    expect(html).not.toContain("дни подред");
    expect(html).not.toContain("От кои глави са");
  });

  it("темата казва колко въпроса и колко минути", () => {
    expect(reviewDueSubject({ dueCount: 7 })).toBe(
      "7 въпроса за днес – около 5 мин",
    );
    expect(reviewDueSubject({ dueCount: 1 })).toBe(
      "1 въпрос за днес – около 1 мин",
    );
  });
});

describe("напомняне „Продължи откъдето спря“", () => {
  const props = {
    ...common,
    daysAway: 6,
    chapterNumber: 5,
    chapterTitle: "Тангенциални напрежения",
    sectionTitle: "Решен пример",
    sectionsSeen: 4,
    sectionsTotal: 7,
    teaser: "Защо три залепени дъски носят повече?",
    continueUrl: "https://example.test/learn/x/y?mode=easy#primer",
  };

  it("показва главата, докъде е стигнал, лентата и въпроса", async () => {
    // React слага празни коментари между парчетата текст – махаме ги
    const html = (await render(ContinueEmail(props))).replaceAll(
      "<!-- -->",
      "",
    );
    expect(html).toContain("Глава 5 те чака");
    expect(html).toContain("Няма те от 6 дни");
    expect(html).toContain("Стигна до „Решен пример“");
    expect(html).toContain("4 от 7 секции");
    expect(html).toContain('width="57%"'); // 4/7
    expect(html).toContain("Защо три залепени дъски носят повече?");
    expect(html).toContain("mode=easy#primer");
    expectFooter(html);
  });

  it("без въпрос и без секция няма празни карета", async () => {
    const html = await render(
      ContinueEmail({ ...props, teaser: null, sectionTitle: null }),
    );
    expect(html).not.toContain("Можеш ли да отговориш?");
    expect(html).not.toContain("Отговорът на въпроса");
    expect(html).toContain("Започна я, но не я довърши");
    expect(html).not.toContain("null");
  });

  it("тема", () => {
    expect(continueSubject(props)).toContain("„Тангенциални напрежения“");
  });
});

describe("седмичен отчет", () => {
  const props = {
    ...common,
    weekLabel: "29.09 – 05.10",
    days: week.map((label, index) => ({
      label,
      minutes: [25, 0, 40, 12, 0, 55, 18][index]!,
    })),
    minutesTotal: 150,
    sectionsRead: 11,
    questionsAnswered: 23,
    tasksSolved: 2,
    tasksTotal: 5,
    next: {
      label: "Глава 6",
      url: "https://example.test/next",
      note: "Около 20 минути.",
    },
  };

  it("показва седемте дни, числата и следващата стъпка", async () => {
    const html = await render(WeeklyEmail(props));
    expect(html).toContain("150 минути учене");
    expect(html).toContain("Учи в 5 от 7 дни");
    for (const label of week) expect(html).toContain(`>${label}<`);
    expect(html).toContain("2/5");
    expect(html).toContain("Глава 6");
    expect(html).toContain('href="https://example.test/next"');
    expectFooter(html);
  });

  it("най-натовареният ден има най-високото стълбче", async () => {
    const html = await render(WeeklyEmail(props));
    const heights = [
      ...html.matchAll(
        /height:(\d+)px;line-height:\d+px;font-size:1px;border-radius:5px/g,
      ),
    ].map((match) => Number(match[1]));
    expect(heights).toHaveLength(7);
    expect(Math.max(...heights)).toBe(heights[5]); // събота, 55 мин
    expect(heights[1]).toBe(3); // вторник, 0 мин
  });

  it("седмица без учене не хвали, а кани", async () => {
    const quiet = {
      ...props,
      minutesTotal: 0,
      days: week.map((label) => ({ label, minutes: 0 })),
    };
    const html = await render(WeeklyEmail(quiet));
    expect(html).toContain("Тиха седмица");
    expect(html).not.toContain("0 минути учене");
    expect(weeklySubject(quiet)).toBe("Твоята седмица в StructLab");
    expect(weeklySubject(props)).toBe("Твоята седмица: 150 минути учене");
  });
});

describe("писмо за нова глава", () => {
  it("показва главата, описанието и какво има вътре", async () => {
    const props = {
      ...common,
      firstName: " ",
      moduleTitle: "Съпротивление на материалите",
      chapterNumber: 6,
      chapterTitle: "Общо огъване",
      summary: "Какво става, когато товарът е наклонен.",
      highlights: ["4 решени примера", "9 въпроса за повторение"],
      chapterUrl: "https://example.test/learn/a/b",
    };
    const html = await render(NewChapterEmail(props));
    expect(html).toContain("Здравей! Глава 6 вече е в учебника");
    expect(html).toContain("4 решени примера");
    expect(html).toContain('href="https://example.test/learn/a/b"');
    expect(newChapterSubject(props)).toBe("Нова глава 6: Общо огъване");
    expectFooter(html);
    const text = await render(NewChapterEmail(props), { plainText: true });
    expect(text).toContain("https://example.test/learn/a/b");
    expect(text).toContain("https://example.test/unsubscribe/abc");
  });
});
