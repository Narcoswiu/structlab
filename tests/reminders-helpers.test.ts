import { describe, expect, it } from "vitest";
import {
  addDays,
  errorClass,
  firstName,
  isPlainTeaser,
  maskEmail,
  previousWeek,
  sofiaLocalToDate,
  sofiaMoment,
  streakDays,
  weekStart,
} from "@/lib/reminders/helpers";
import { SAMPLE_TEMPLATES, isSampleTemplate } from "@/lib/reminders/templates";

describe("българско време", () => {
  it("лятно време е UTC+3, зимно – UTC+2", () => {
    expect(sofiaMoment(new Date("2026-07-15T18:00:00Z"))).toEqual({
      day: "2026-07-15",
      hour: 21,
      minute: 0,
      weekday: 2,
    });
    expect(sofiaMoment(new Date("2026-01-15T18:00:00Z"))).toMatchObject({
      day: "2026-01-15",
      hour: 20,
    });
  });

  it("денят и денят от седмицата се сменят в полунощ българско време", () => {
    // неделя 23:30 UTC+3 = още неделя; 21:30 UTC в неделя = понеделник 00:30
    expect(sofiaMoment(new Date("2026-10-11T20:30:00Z"))).toMatchObject({
      day: "2026-10-11",
      hour: 23,
      weekday: 6,
    });
    expect(sofiaMoment(new Date("2026-10-11T21:30:00Z"))).toMatchObject({
      day: "2026-10-12",
      hour: 0,
      weekday: 0,
    });
  });

  it("полунощ е час 0, не 24", () => {
    expect(sofiaMoment(new Date("2026-01-14T22:00:00Z")).hour).toBe(0);
  });

  it("местно време → момент, през лятото и през зимата", () => {
    expect(sofiaLocalToDate("2026-07-15T12:00")?.toISOString()).toBe(
      "2026-07-15T09:00:00.000Z",
    );
    expect(sofiaLocalToDate("2026-01-15T12:00")?.toISOString()).toBe(
      "2026-01-15T10:00:00.000Z",
    );
    expect(sofiaLocalToDate("2026-10-12T00:00")?.toISOString()).toBe(
      "2026-10-11T21:00:00.000Z",
    );
    expect(sofiaLocalToDate("утре")).toBeNull();
    expect(sofiaLocalToDate("2026-13-40T12:00")).toBeNull();
  });
});

describe("седмици", () => {
  it("addDays минава през месеци и години", () => {
    expect(addDays("2026-10-01", -1)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("седмицата започва в понеделник", () => {
    expect(weekStart(new Date("2026-10-12T09:00:00Z"))).toBe("2026-10-12");
    expect(weekStart(new Date("2026-10-18T09:00:00Z"))).toBe("2026-10-12");
    // понеделник 00:30 в София (още неделя по UTC)
    expect(weekStart(new Date("2026-10-11T21:30:00Z"))).toBe("2026-10-12");
  });

  it("предишната седмица: седем дни от понеделник до неделя и етикет", () => {
    const week = previousWeek(new Date("2026-10-12T07:10:00Z"));
    expect(week.days).toEqual([
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
    ]);
    expect(week.label).toBe("05.10 – 11.10");
    // и в четвъртък „предишната“ е същата
    expect(previousWeek(new Date("2026-10-15T07:10:00Z")).days[0]).toBe(
      "2026-10-05",
    );
    // през границата на месеца
    expect(previousWeek(new Date("2026-10-06T07:10:00Z")).label).toBe(
      "28.09 – 04.10",
    );
  });
});

describe("серия от поредни дни", () => {
  const today = "2026-10-13";
  it("брои назад от вчера, когато днес още няма активност", () => {
    expect(streakDays(["2026-10-12", "2026-10-11", "2026-10-10"], today)).toBe(
      3,
    );
  });
  it("днешният ден се брои, ако вече има активност", () => {
    expect(streakDays(["2026-10-13", "2026-10-12"], today)).toBe(2);
  });
  it("прекъсване спира серията", () => {
    expect(streakDays(["2026-10-12", "2026-10-10", "2026-10-09"], today)).toBe(
      1,
    );
  });
  it("без активност вчера и днес няма серия", () => {
    expect(streakDays(["2026-10-11", "2026-10-10"], today)).toBe(0);
    expect(streakDays([], today)).toBe(0);
  });
});

describe("маскиране на адреси", () => {
  it("оставя първата буква и домейна", () => {
    expect(maskEmail("maria.petrova@gmail.com")).toBe("m***@gmail.com");
    expect(maskEmail("a@abv.bg")).toBe("a***@abv.bg");
  });
  it("счупен адрес не се показва изобщо", () => {
    expect(maskEmail("")).toBe("***");
    expect(maskEmail("@gmail.com")).toBe("***");
    expect(maskEmail("без-кльомба")).toBe("***");
  });
});

describe("въпрос за закачка в писмото", () => {
  it("приема обикновено изречение", () => {
    expect(isPlainTeaser("Защо три залепени дъски носят повече?")).toBe(true);
    expect(
      isPlainTeaser("Къде моментът е най-голям – в средата или в опората?"),
    ).toBe(true);
  });
  it.each([
    "Колко е $M_{max}$ за проста греда?",
    "Какво означава **неутрална ос**?",
    "Какво е _статичен момент_ на сечението?",
    "Коя е формулата `W = I / y`?",
    "Виж [фигурата](figure:greda) и кажи защо.",
    "Колко е \\sigma при опън на прът?",
    "Първи ред на въпроса\nвтори ред на въпроса",
    "Защо?",
    `${"Много дълъг въпрос ".repeat(15)}?`,
  ])("отхвърля %s", (question) => {
    expect(isPlainTeaser(question)).toBe(false);
  });
});

describe("дребни помощници", () => {
  it("първо име", () => {
    expect(firstName("  Мария  Петрова ")).toBe("Мария");
    expect(firstName("")).toBe("");
  });

  it("класът на грешката никога не е текстът ѝ (в него може да има адрес)", () => {
    const smtp = Object.assign(new Error("550 no such user maria@gmail.com"), {
      code: "EENVELOPE",
    });
    expect(errorClass(smtp)).toBe("EENVELOPE");
    expect(
      errorClass(Object.assign(new Error("x@y.bg"), { responseCode: 550 })),
    ).toBe("SMTP_550");
    expect(errorClass(new TypeError("maria@gmail.com"))).toBe("TypeError");
    expect(errorClass("maria@gmail.com")).toBe("Error");
    expect(errorClass({ code: "maria@gmail.com" })).toBe("Error");
  });

  it("шаблоните за преглед са точно четири", () => {
    expect(SAMPLE_TEMPLATES).toEqual([
      "review",
      "continue",
      "weekly",
      "new-chapter",
    ]);
    expect(isSampleTemplate("weekly")).toBe(true);
    expect(isSampleTemplate("invite")).toBe(false);
    expect(isSampleTemplate(null)).toBe(false);
  });
});
