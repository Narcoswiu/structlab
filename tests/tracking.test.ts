import { describe, expect, it } from "vitest";
import { CHAPTER_SECTIONS } from "@/lib/content/sections";

// Тези модули внасят "server-only"; в unit тестовете го заместваме с празен модул
// (виж vitest.config.mts).
import {
  csvCell,
  dayKey,
  usersToCsv,
  type UserActivity,
} from "@/lib/admin-activity";
import { formatDuration, toChapterProgress } from "@/lib/progress";

describe("прогрес по глава", () => {
  it("брои само истинските секции и не надвишава 7", () => {
    expect(toChapterProgress([])).toEqual({ seen: 0, total: 7, percent: 0 });
    expect(toChapterProgress(["zagadka", "vizh"])).toEqual({
      seen: 2,
      total: 7,
      percent: 29,
    });
    expect(toChapterProgress(["zagadka", "измислена", "chast-1"]).seen).toBe(1);
    expect(toChapterProgress(CHAPTER_SECTIONS.map((s) => s.id))).toEqual({
      seen: 7,
      total: 7,
      percent: 100,
    });
  });
});

describe("показване на времето", () => {
  it("под минута, минути, часове", () => {
    expect(formatDuration(0)).toBe("под 1 мин");
    expect(formatDuration(20)).toBe("под 1 мин");
    expect(formatDuration(95)).toBe("2 мин");
    expect(formatDuration(3600)).toBe("1 ч");
    expect(formatDuration(3700)).toBe("1 ч 2 мин");
  });
});

describe("ден по българско време", () => {
  it("късна вечер по UTC е вече следващият ден в София", () => {
    expect(dayKey(new Date("2026-10-10T12:00:00Z"))).toBe("2026-10-10");
    expect(dayKey(new Date("2026-10-10T22:30:00Z"))).toBe("2026-10-11");
  });
});

describe("CSV експорт", () => {
  const user: UserActivity = {
    id: "1",
    email: "maria@example.test",
    fullName: 'Мария "Мими" Иванова',
    role: "student",
    specialty: "ВСУ СИ",
    status: "active",
    lastActivityAt: "2026-10-10T08:00:00Z",
    seconds: 1830,
    chaptersOpened: 2,
    percent: 57,
  };

  it("има заглавен ред, кавички около всяка клетка и BOM за Excel", () => {
    const csv = usersToCsv([user]);
    expect(csv.startsWith("﻿")).toBe(true);
    const [head, row] = csv.slice(1).trim().split("\r\n");
    expect(head).toContain('"Имейл","Име","Специалност"');
    expect(row).toContain('"maria@example.test"');
    expect(row).toContain('"Мария ""Мими"" Иванова"');
    expect(row).toContain('"активен"');
    expect(row).toContain('"31"'); // 1830 s = 30,5 мин → 31
    expect(row).toContain('"57"');
  });

  it("обезврежда стойности, които Excel би изпълнил като формула", () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    );
    expect(csvCell("+1")).toBe('"\'+1"');
    expect(csvCell("@cmd")).toBe('"\'@cmd"');
    expect(csvCell("обикновен, текст")).toBe('"обикновен, текст"');
    expect(csvCell(42)).toBe('"42"');
  });

  it("празен списък дава само заглавния ред", () => {
    expect(usersToCsv([]).trim().split("\r\n")).toHaveLength(1);
  });
});
