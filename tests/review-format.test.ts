import { describe, expect, it } from "vitest";
import {
  REVIEW_INTERVALS,
  daysBetween,
  describeDue,
  describeOutcome,
  formatDayMonth,
  questionsLabel,
  sofiaToday,
} from "@/lib/review-format";

describe("дати за повторението", () => {
  it("денят се сменя по българско време, не по UTC", () => {
    // 22:30 UTC на 8 октомври е вече 01:30 на 9 октомври в София (лятно време, UTC+3)
    expect(sofiaToday(new Date("2026-10-08T22:30:00Z"))).toBe("2026-10-09");
    expect(sofiaToday(new Date("2026-10-08T20:30:00Z"))).toBe("2026-10-08");
    // зимно време, UTC+2
    expect(sofiaToday(new Date("2026-12-31T22:30:00Z"))).toBe("2027-01-01");
  });

  it("брои дните между две дати, и през смяна на месеца и на часа", () => {
    expect(daysBetween("2026-10-08", "2026-10-09")).toBe(1);
    expect(daysBetween("2026-10-08", "2026-10-22")).toBe(14);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2); // смяна на часа
    expect(daysBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(daysBetween("2026-10-08", "2026-10-07")).toBe(-1);
  });

  it("интервалите са 1, 3, 7 и 14 дни", () => {
    expect([...REVIEW_INTERVALS]).toEqual([1, 3, 7, 14]);
  });

  it("казва кога е следващото повторение с думи", () => {
    expect(describeDue("2026-10-08", "2026-10-08")).toBe("днес");
    expect(describeDue("2026-10-01", "2026-10-08")).toBe("днес");
    expect(describeDue("2026-10-09", "2026-10-08")).toBe("утре");
    expect(describeDue("2026-10-11", "2026-10-08")).toBe(
      "след 3 дни (на 11.10.)",
    );
    expect(formatDayMonth("2026-01-05")).toBe("05.01.");
  });

  it("съобщението след отговор", () => {
    const today = "2026-10-08";
    expect(
      describeOutcome({ box: 1, dueOn: "2026-10-09", knew: false }, today),
    ).toBe("Няма проблем. Ще ти го покажем пак утре.");
    expect(
      describeOutcome({ box: 3, dueOn: "2026-10-15", knew: true }, today),
    ).toBe("Отбелязано. Ще ти го покажем пак след 7 дни (на 15.10.).");
    expect(
      describeOutcome({ box: 5, dueOn: null, knew: true }, today),
    ).toContain("научен");
  });

  it("брой въпроси", () => {
    expect(questionsLabel(1)).toBe("1 въпрос");
    expect(questionsLabel(2)).toBe("2 въпроса");
    expect(questionsLabel(12)).toBe("12 въпроса");
  });
});
