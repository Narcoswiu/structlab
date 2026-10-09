import { describe, expect, it } from "vitest";
import {
  buildTruss,
  defaultTrussInput,
  solveTrussLab,
  trussKinds,
  trussPresets,
  type TrussInput,
} from "@/lib/labs/truss";

// Очакваните числа са от tests/engineering/truss.test.ts – там сметката на
// ръка стои в коментара над всеки тест (примерите от главата за ферми).
// Знак: опън = плюс, натиск = минус.

const preset = (label: string): TrussInput =>
  trussPresets.find((item) => item.label === label)!.input;

function solved(input: TrussInput) {
  const solution = solveTrussLab(input);
  if (!solution.ok) throw new Error(solution.problem);
  return solution;
}

const forces = (input: TrussInput) =>
  Object.fromEntries(solved(input).rows.map((row) => [row.id, row.force]));

const result = (input: TrussInput, name: string) =>
  solved(input).results.find((item) => item.name === name);

const step = (input: TrussInput, title: string) =>
  solved(input).steps.find((item) => item.title === title)?.lines ?? [];

describe("изпитната ферма с успоредни пояси: 40 и 20 kN надолу, 12 kN надясно", () => {
  const input = preset("Изпитна ферма: 40, 20 и 12 kN");

  it("реакции: A_h = −12; A_v = 36; B_v = 24 kN", () => {
    const solution = solved(input);
    expect(solution.Ah).toBe(-12);
    expect(solution.Av).toBe(36);
    expect(solution.Bv).toBe(24);
    expect(result(input, "A_h")).toMatchObject({
      value: "−12 kN",
      note: "наляво – обратно на приетата посока",
    });
  });

  it("всички 13 усилия", () => {
    expect(forces(input)).toEqual({
      AC: 39,
      CD: 39,
      DE: 18,
      EB: 18,
      FG: -24,
      GH: -24,
      AF: -45,
      HB: -30,
      CF: 0,
      DG: -20,
      EH: 0,
      FD: -5,
      DH: 30,
    });
  });

  it("таблицата: дължини, вид и най-големите усилия", () => {
    const solution = solved(input);
    const row = (id: string) => solution.rows.find((item) => item.id === id);
    expect(row("AF")).toEqual({
      id: "AF",
      length: 5,
      force: -45,
      state: "натиск",
    });
    expect(row("AC")).toMatchObject({ length: 3, state: "опън" });
    expect(row("CF")).toMatchObject({ length: 4, force: 0, state: "нулев" });
    expect(solution.maxTension).toEqual({ ids: ["AC", "CD"], force: 39 });
    expect(solution.maxCompression).toEqual({ ids: ["AF"], force: -45 });
    expect(result(input, "Най-голям опън")).toEqual({
      name: "Най-голям опън",
      value: "39 kN",
      note: "пръти AC и CD",
    });
    expect(result(input, "Най-голям натиск")).toEqual({
      name: "Най-голям натиск",
      value: "−45 kN",
      note: "прът AF",
    });
  });

  it("определимост: m + C = 13 + 3 = 16 = 2·8", () => {
    expect(solved(input).determinacy).toEqual({
      members: 13,
      links: 3,
      joints: 8,
    });
    expect(result(input, "Определимост m + C = 2·j")?.value).toBe(
      "13 + 3 = 2·8",
    );
    expect(step(input, "Статическа определимост")).toContain(
      "m + C = 13 + 3 = 16",
    );
  });

  it("реакциите са разписани, с проверката ΣM_B от текста", () => {
    const lines = step(input, "Опорни реакции");
    expect(lines).toContain("ΣF_x = A_h + 12 = 0");
    expect(lines).toContain("ΣM_A = B_v·12 − 40·3 − 20·6 − 12·4 = 0");
    expect(lines).toContain("B_v = 288 / 12 = 24 kN");
    expect(lines).toContain("ΣF_y = A_v + 24 − 40 − 20 = 0");
    expect(lines).toContain("ΣM_B = −36·12 + 40·9 + 20·6 − 12·4 = 0");
  });

  it("първите два възела: A и C, с уравненията от текста", () => {
    const solution = solved(input);
    expect(solution.steps.map((item) => item.title)).toEqual([
      "Правило за знаците",
      "Статическа определимост",
      "Опорни реакции",
      "Метод на възлите: възел A",
      "Метод на възлите: възел C",
      "Нулеви пръти",
      "Ритеров разрез през FG, FD и CD",
    ]);
    const a = step(input, "Метод на възлите: възел A");
    expect(a).toContain(
      "Прът AF: дължина √(3² + 4²) = 5 m; cos α = 3 / 5 = 0,6; sin α = 4 / 5 = 0,8.",
    );
    // A: 36 + 0,8·S_AF = 0 → −45;  −12 + S_AC + 0,6·(−45) = 0 → 39
    expect(a).toContain("ΣF_y = 36 + 0,8·S_AF = 0");
    expect(a).toContain("S_AF = −45 kN (натиск)");
    expect(a).toContain("ΣF_x = −12 + S_AC + 0,6·(−45) = 0");
    expect(a).toContain("S_AC = 39 kN (опън)");
    const c = step(input, "Метод на възлите: възел C");
    expect(c).toContain("S_CF = 0 kN (нулев)");
    expect(c).toContain("ΣF_x = −39 + S_CD = 0");
    expect(c.at(-1)).toMatch(/в реда B, E, F, D и G/);
  });

  it("Ритеров разрез FG–FD–CD: S_FG = −24, S_FD = −5, S_CD = 39 kN", () => {
    const lines = step(input, "Ритеров разрез през FG, FD и CD");
    // −36·6 + 40·3 − S_FG·4 = 0 → S_FG = −24
    expect(lines).toContain("ΣM_D = −36·6 + 40·3 − S_FG·4 = 0");
    expect(lines).toContain("S_FG = −24 kN (натиск)");
    expect(lines).toContain("ΣF_y = 36 − 40 − 0,8·S_FD = 0");
    expect(lines).toContain("S_FD = −5 kN (натиск)");
    expect(lines).toContain("ΣM_F = −36·3 − 12·4 + S_CD·4 = 0");
    expect(lines).toContain("S_CD = 39 kN (опън)");
  });

  it("нулевите пръти по правилата са CF и EH", () => {
    expect(step(input, "Нулеви пръти")[0]).toBe(
      "Прътите CF и EH се разпознават и без сметки – по правилата за нулеви пръти.",
    );
  });

  it("правилото за знаците е казано изрично", () => {
    expect(step(input, "Правило за знаците")).toContain(
      "Положителен резултат е опън, отрицателен – натиск.",
    );
  });
});

describe("фермата-мост: по 20 kN в долните възли C, D, E", () => {
  const input = preset("Ферма-мост: 3 × 20 kN");

  it("реакции по 30 kN и усилията от текста", () => {
    const solution = solved(input);
    expect([solution.Ah, solution.Av, solution.Bv]).toEqual([0, 30, 30]);
    expect(forces(input)).toEqual({
      AC: 22.5,
      CD: 22.5,
      DE: 22.5,
      EB: 22.5,
      FG: -30,
      GH: -30,
      AF: -37.5,
      HB: -37.5,
      CF: 20,
      EH: 20,
      FD: 12.5,
      DH: 12.5,
      DG: 0,
    });
    expect(solution.maxCompression).toEqual({
      ids: ["AF", "HB"],
      force: -37.5,
    });
  });

  it("Ритеров разрез: S_FG = −30, S_CD = 22,5, S_FD = 12,5 kN", () => {
    const lines = step(input, "Ритеров разрез през FG, FD и CD");
    expect(lines).toContain("ΣM_D = −30·6 + 20·3 − S_FG·4 = 0");
    expect(lines).toContain("S_FG = −30 kN (натиск)");
    expect(lines).toContain("ΣM_F = −30·3 + S_CD·4 = 0");
    expect(lines).toContain("S_CD = 22,5 kN (опън)");
    expect(lines).toContain("ΣF_y = 30 − 20 − 0,8·S_FD = 0");
    expect(lines).toContain("S_FD = 12,5 kN (опън)");
  });

  it("усилията в поясите са обратно пропорционални на височината: S_FG = −120/h", () => {
    expect(forces({ ...input, height: 3 }).FG).toBeCloseTo(-40, 9);
    expect(forces({ ...input, height: 2 }).FG).toBeCloseTo(-60, 9);
  });

  it("само 48 kN надолу в G: реакции по 24 kN", () => {
    const only: TrussInput = {
      ...input,
      loads: { G: 48 },
    };
    const solution = solved(only);
    expect([solution.Av, solution.Bv]).toEqual([24, 24]);
  });
});

describe("покривната ферма 8 × 3 m: 12, 12 и 24 kN", () => {
  const input = preset("Покривна ферма 8 × 3 m");

  it("реакции A_v = 21, B_v = 27 kN и деветте усилия", () => {
    const solution = solved(input);
    expect([solution.Ah, solution.Av, solution.Bv]).toEqual([0, 21, 27]);
    expect(forces(input)).toEqual({
      AC: -35,
      CE: -25,
      EF: -25,
      FB: -45,
      AD: 28,
      DB: 36,
      CD: -10,
      FD: -20,
      DE: 18,
    });
    expect(result(input, "Определимост m + C = 2·j")?.value).toBe(
      "9 + 3 = 2·6",
    );
  });

  it("Ритеров разрез CE–CD–AD с рамената от текста: 2,4; 2,4 и 1,5 m", () => {
    const lines = step(input, "Ритеров разрез през CE, CD и AD");
    // −21·4 + 12·2 − S_CE·2,4 = 0 → −25
    expect(lines).toContain("ΣM_D = −21·4 + 12·2 − S_CE·2,4 = 0");
    expect(lines).toContain("S_CE = −25 kN (натиск)");
    // −12·2 − S_CD·2,4 = 0 → −10
    expect(lines).toContain("ΣM_A = −12·2 − S_CD·2,4 = 0");
    expect(lines).toContain("S_CD = −10 kN (натиск)");
    // −21·2 + S_AD·1,5 = 0 → 28
    expect(lines).toContain("ΣM_C = −21·2 + S_AD·1,5 = 0");
    expect(lines).toContain("S_AD = 28 kN (опън)");
  });

  it("възел A: 21 + 0,6·S_AC = 0 → −35; S_AD = 0,8·35 = 28", () => {
    const lines = step(input, "Метод на възлите: възел A");
    expect(lines).toContain("ΣF_y = 21 + 0,6·S_AC = 0");
    expect(lines).toContain("S_AC = −35 kN (натиск)");
    expect(lines).toContain("ΣF_x = 0,8·(−35) + S_AD = 0");
  });
});

describe("триъгълните ферми", () => {
  it("4 × 1,5 m, 12 kN: реакции по 6; S_AC = S_CB = −10; S_AB = 8 kN", () => {
    const input = preset("Триъгълна ферма 4 × 1,5 m");
    const solution = solved(input);
    expect([solution.Av, solution.Bv]).toEqual([6, 6]);
    expect(forces(input)).toEqual({ AC: -10, CB: -10, AB: 8 });
    const b = step(input, "Метод на възлите: възел B");
    expect(b).toContain("Изрязва се възел B. Неизвестно е S_CB.");
    expect(b).toContain("ΣF_x = −0,8·(−10) − 8 = 0");
    expect(step(input, "Ритеров разрез")[0]).toMatch(/само три пръта/);
  });

  it("6 × 4 m, 16 kN: реакции по 8; S_AC = −10; S_AB = 6 kN", () => {
    const input: TrussInput = {
      kind: "triangle",
      span: 6,
      height: 4,
      loads: { C: 16 },
      horizontal: 0,
    };
    expect(solved(input).Av).toBe(8);
    expect(forces(input)).toMatchObject({ AC: -10, AB: 6 });
  });
});

describe("геометрия и граници", () => {
  it("всяка геометрия е статически определима и без NaN при всякакви размери", () => {
    for (const kind of trussKinds) {
      for (const [span, height] of [
        [1, 50],
        [100, 0.1],
        [7.3, 2.9],
      ] as const) {
        const input = { ...defaultTrussInput(kind.id), span, height };
        const solution = solved(input);
        const { members, links, joints } = solution.determinacy;
        expect(members + links).toBe(2 * joints);
        expect(JSON.stringify(solution)).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("координатите следват отвора и височината", () => {
    const truss = buildTruss({ ...preset("Покривна ферма 8 × 3 m") });
    expect(truss.joints).toEqual([
      { id: "A", x: 0, y: 0 },
      { id: "D", x: 4, y: 0 },
      { id: "B", x: 8, y: 0 },
      { id: "C", x: 2, y: 1.5 },
      { id: "E", x: 4, y: 3 },
      { id: "F", x: 6, y: 1.5 },
    ]);
  });

  it("без товари: всички пръти са нулеви и няма най-голямо усилие", () => {
    const input: TrussInput = {
      ...preset("Ферма-мост: 3 × 20 kN"),
      loads: {},
    };
    const solution = solved(input);
    expect(solution.rows.every((row) => row.state === "нулев")).toBe(true);
    expect(solution.maxTension).toBeNull();
    expect(result(input, "Най-голям опън")).toMatchObject({
      value: "няма",
      note: "няма опънат прът",
    });
  });

  it("нулева височина, отрицателен товар и нечислови данни дават съобщение", () => {
    const base = preset("Изпитна ферма: 40, 20 и 12 kN");
    const problem = (input: TrussInput) => {
      const solution = solveTrussLab(input);
      return solution.ok ? null : solution.problem;
    };
    expect(problem({ ...base, height: 0 })).toMatch(
      /Височината трябва да е положителна/,
    );
    expect(problem({ ...base, span: 0 })).toBe(
      "Отворът трябва да е положителен.",
    );
    expect(problem({ ...base, loads: { F: -5 } })).toBe(
      "Товарите са надолу – въведи положителни числа.",
    );
    expect(problem({ ...base, horizontal: Number.NaN })).toBe(
      "Въведи числа във всички полета.",
    );
  });
});
