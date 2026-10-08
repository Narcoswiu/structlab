import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  WITHOUT_OUTLINE,
  catalogDisciplines,
  loadOutlines,
} from "../../scripts/outlines.mts";

const { outlines, problems } = loadOutlines();

describe("планове на дисциплините", () => {
  it("минават собствената си проверка", () => {
    expect(problems).toEqual([]);
  });

  it("всяка дисциплина от каталога има план или е нарочно без план", () => {
    const covered = new Set(outlines.map((outline) => outline.title));
    const missing = [...catalogDisciplines()].filter(
      (name) => !covered.has(name) && !WITHOUT_OUTLINE.has(name),
    );
    expect(missing).toEqual([]);
  });

  it("файлът, който сайтът чете, е в крак с плановете", () => {
    const generated = JSON.parse(
      readFileSync("lib/outlines.generated.json", "utf8"),
    );
    // ако този тест падне: pnpm outlines:build
    expect(generated).toEqual(outlines);
  });

  it("„официален“ е само план с адрес на университета", () => {
    for (const outline of outlines) {
      if (outline.official) {
        expect(outline.sourceUrl, outline.slug).toMatch(
          /^https:\/\/(old\.uacg\.bg|uacg\.bg|web\.archive\.org|vsu\.bg)\//,
        );
      }
    }
    expect(outlines.filter((outline) => outline.official).length).toBeGreaterThan(50);
  });

  it("свързаните дисциплини съществуват и планът не сочи към себе си", () => {
    const disciplines = catalogDisciplines();
    for (const outline of outlines) {
      for (const related of outline.related) {
        expect(disciplines.has(related), `${outline.slug} → ${related}`).toBe(true);
      }
    }
  });

  it("главите в един план не се повтарят", () => {
    for (const outline of outlines) {
      const titles = outline.chapters.map((chapter) => chapter.title);
      expect(new Set(titles).size, outline.slug).toBe(titles.length);
    }
  });
});
