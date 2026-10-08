import { describe, expect, it } from "vitest";
import {
  extractQuizzes,
  findQuizProblems,
  quizKey,
  stripQuizNumber,
} from "@/lib/content/quiz";
import { loadChapters } from "../../scripts/content.mts";

const quiz = (question: string, answer: string) =>
  `::::quiz\n${question}\n\n:::answer\n${answer}\n:::\n::::\n`;

describe("въпроси „Провери се“", () => {
  const md = `## Провери се\n\n${quiz("**1.** Колко е $2+2$?", "Четири.")}\n${quiz("**2.** А $3+3$?", "Шест.\n\nДва реда.")}`;

  it("намира въпросите по реда им, с текст и отговор", () => {
    const items = extractQuizzes(md);
    expect(items.map((item) => item.position)).toEqual([1, 2]);
    expect(items[0]).toMatchObject({
      question: "**1.** Колко е $2+2$?",
      answer: "Четири.",
    });
    expect(items[1]!.answer).toBe("Шест.\n\nДва реда.");
    expect(findQuizProblems(md)).toEqual([]);
  });

  it("отпечатъкът не зависи от номера и от интервалите, но зависи от текста", () => {
    expect(quizKey("**1.** Колко е  $2+2$?")).toBe(quizKey("**7.** Колко е $2+2$?"));
    expect(quizKey("**1.** Колко е $2+2$?")).not.toBe(quizKey("**1.** Колко е $2+3$?"));
    expect(quizKey("x")).toMatch(/^[a-f0-9]{16}$/);
  });

  it("маха само водещия номер", () => {
    expect(stripQuizNumber("**12.** Текст **2.** още")).toBe("Текст **2.** още");
    expect(stripQuizNumber("Без номер")).toBe("Без номер");
  });

  it("въпрос без отговор или с незатворен блок е грешка", () => {
    const broken = "::::quiz\n**1.** Въпрос?\n::::\n";
    expect(findQuizProblems(broken)[0]).toContain("разпознатите въпроси са 0");
  });

  it("повторен въпрос и фигура във въпрос са грешки", () => {
    const twice = quiz("**1.** Едно и също?", "Да.") + quiz("**2.** Едно и също?", "Да.");
    expect(findQuizProblems(twice).some((p) => p.includes("се повтаря"))).toBe(true);
    const figure = quiz("**1.** Виж ![а](figure:x)", "Да.");
    expect(findQuizProblems(figure).some((p) => p.includes("фигура"))).toBe(true);
  });
});

describe("въпросите в истинските глави", () => {
  const chapters = loadChapters();

  // Главите не са в публичното репо – на чужда машина този тест няма какво да провери.
  it.skipIf(chapters.length === 0)(
    "всяка глава има поне 3 разпознати въпроса във всеки режим и няма грешки",
    () => {
      for (const chapter of chapters) {
        for (const mode of ["easy", "detailed"] as const) {
          const items = extractQuizzes(chapter[mode]);
          expect(items.length, `${chapter.meta.slug} ${mode}`).toBeGreaterThanOrEqual(3);
          expect(findQuizProblems(chapter[mode])).toEqual([]);
        }
      }
    },
  );
});
