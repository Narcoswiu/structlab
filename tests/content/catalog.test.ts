import { describe, expect, it } from "vitest";
import { loadCatalog } from "../../scripts/catalog.mts";

const { catalog, problems } = loadCatalog();
const find = (university: string, specialty: string) =>
  catalog.universities
    .find((u) => u.slug === university)!
    .specialties.find((s) => s.slug === specialty)!;

describe("каталог на специалностите", () => {
  it("минава собствената си проверка", () => {
    expect(problems).toEqual([]);
  });

  it("съдържа четирите специалности на ВСУ и двете на УАСГ", () => {
    const names = catalog.universities.map((u) => [
      u.short_name,
      u.specialties.map((s) => s.short_name),
    ]);
    expect(names).toEqual([
      ["ВСУ", ["СИ", "ССС", "ССС-СК", "СМ"]],
      ["УАСГ", ["ССС", "УС"]],
    ]);
  });

  it("във ВСУ Съпротивление на материалите е във II курс, зимен – за всичките четири", () => {
    for (const slug of ["stroitelno-inzhenerstvo", "sss", "sss-sk", "stroitelen-menidzhmant"]) {
      expect(find("vsu", slug).plan["2w"]).toContain("Съпротивление на материалите");
    }
  });

  it("в УАСГ ССС дисциплината е в два семестъра на II курс", () => {
    const plan = find("uasg", "sss").plan;
    expect(plan["2w"]).toContain("Съпротивление на материалите");
    expect(plan["2s"]).toContain("Съпротивление на материалите");
    expect(plan["1s"]).toContain("Теоретична механика – I част");
  });

  it("в „Управление в строителството“ няма Съпротивление на материалите", () => {
    const all = Object.values(find("uasg", "upravlenie-v-stroitelstvoto").plan).flat();
    expect(all).not.toContain("Съпротивление на материалите");
    expect(all).toContain("Строителна механика");
  });

  it("всяка специалност казва откъде са данните ѝ", () => {
    for (const university of catalog.universities) {
      for (const specialty of university.specialties) {
        expect(specialty.note.length).toBeGreaterThan(30);
      }
    }
  });

  it("всяка връзка към модул се използва в поне един учебен план", () => {
    const titles = new Set(
      catalog.universities.flatMap((u) =>
        u.specialties.flatMap((s) => Object.values(s.plan).flat()),
      ),
    );
    for (const title of Object.keys(catalog.links)) {
      expect(titles.has(title)).toBe(true);
    }
  });
});
