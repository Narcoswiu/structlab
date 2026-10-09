import { describe, expect, it } from "vitest";
import {
  elasticCurve,
  flexuralRigidity,
  standardDeflection,
} from "@/lib/engineering/deflection";
import {
  maxDeflectionPosition,
  standardDeflectionAt,
  type CurveCase,
} from "@/lib/engineering/deflection-curve";
import type { Beam } from "@/lib/engineering/beam";
import {
  deflectionPresets,
  deflectionSchemes,
  solveDeflection,
  spanRatioLabel,
  type DeflectionInput,
} from "@/lib/labs/deflection";

// Очакваните числа са отпечатаните в Глава 6; сметките на ръка са в
// tests/engineering/deflection.test.ts.

const preset = (index: number): DeflectionInput =>
  deflectionPresets[index]!.input;

function solved(input: DeflectionInput) {
  const solution = solveDeflection(input);
  if (!solution.ok) throw new Error(solution.problem);
  return solution;
}

const result = (input: DeflectionInput, name: string) =>
  solved(input).results.find((item) => item.name === name);

const allLines = (input: DeflectionInput) =>
  solved(input).steps.flatMap((step) => step.lines);

describe("еластичната линия в затворен вид", () => {
  const cases: CurveCase[] = [
    "cantilever-force",
    "cantilever-distributed",
    "simple-force-mid",
    "simple-distributed",
  ];

  it.each(cases)("%s: най-голямата стойност е f от таблицата", (kind) => {
    const l = 3.2;
    const EI = 850;
    const xMax = maxDeflectionPosition(kind, l);
    expect(standardDeflectionAt(kind, 7, l, EI, xMax)).toBeCloseTo(
      standardDeflection(kind, 7, l, EI).f,
      12,
    );
    // никъде по гредата провисването не е по-голямо
    for (let k = 0; k <= 40; k++) {
      expect(
        standardDeflectionAt(kind, 7, l, EI, (l * k) / 40),
      ).toBeLessThanOrEqual(standardDeflection(kind, 7, l, EI).f + 1e-12);
    }
  });

  it.each(cases)(
    "%s: съвпада с численото интегриране във всеки възел",
    (kind) => {
      const l = 4;
      const EI = 1000;
      const load = 6;
      const beam: Beam = {
        length: l,
        supports: kind.startsWith("cantilever")
          ? { type: "cantilever", fixedAt: "left" }
          : { type: "simple", xA: 0, xB: l },
        loads: kind.endsWith("distributed")
          ? [{ type: "distributed", x1: 0, x2: l, value: load }]
          : [{ type: "force", x: maxDeflectionPosition(kind, l), value: load }],
      };
      for (const point of elasticCurve(beam, EI, 10)) {
        expect(standardDeflectionAt(kind, load, l, EI, point.x)).toBeCloseTo(
          point.w,
          10,
        );
      }
    },
  );

  it("конзола със сила: w(1) = 3·1²·(3·2 − 1)/(6·1000) = 0,0025 m", () => {
    expect(standardDeflectionAt("cantilever-force", 3, 2, 1000, 1)).toBeCloseTo(
      0.0025,
      12,
    );
  });

  it("в опорите провисването е нула; сечение извън гредата се отказва", () => {
    expect(standardDeflectionAt("simple-force-mid", 12, 4, 1000, 0)).toBe(0);
    expect(standardDeflectionAt("simple-force-mid", 12, 4, 1000, 4)).toBe(0);
    expect(standardDeflectionAt("cantilever-distributed", 6, 2, 1000, 0)).toBe(
      0,
    );
    expect(() =>
      standardDeflectionAt("simple-distributed", 3, 4, 1000, 4.1),
    ).toThrow();
    expect(() =>
      standardDeflectionAt("cantilever-force", 3, 0, 1000, 0),
    ).toThrow();
    expect(() =>
      standardDeflectionAt("cantilever-force", 3, 2, 0, 1),
    ).toThrow();
  });
});

describe("дървена греда 10×20 cm, l = 4 m, q = 4 kN/m, E = 1100 kN/cm²", () => {
  const input = preset(0);

  it("f = 5120/281 600 = 0,01818 m = 18,18 mm (1,82 cm)", () => {
    const solution = solved(input);
    expect(solution.EI).toBeCloseTo(733.3333, 3);
    expect(solution.fMm.toFixed(2)).toBe("18.18");
    expect(result(input, "Най-голямо провисване f")).toEqual({
      name: "Най-голямо провисване f",
      value: "18,18 mm",
      note: "1,82 cm – в средата",
    });
  });

  it("φ_A = 256/17 600 = 0,01455 rad = 0,83°", () => {
    expect(result(input, "Ъгъл на завъртане φ")).toEqual({
      name: "Ъгъл на завъртане φ",
      value: "0,01455 rad",
      note: "0,83° – при опорите",
    });
  });

  it("l/f = 4000/18,18 = 220; l/250 = 16 mm < 18,18 mm → не е изпълнено", () => {
    const solution = solved(input);
    expect(result(input, "Отношение l/f")?.value).toBe("l/220");
    expect(solution.allowMm).toBeCloseTo(16, 9);
    expect(solution.withinLimit).toBe(false);
    expect(solution.verdict).toBe(
      "Условието не е изпълнено: f = 18,18 mm > l/250 = 16 mm.",
    );
  });

  it("с допустимо l/200 = 20 mm условието е изпълнено", () => {
    const solution = solved({ ...input, limit: 200 });
    expect(solution.withinLimit).toBe(true);
    expect(solution.verdict).toBe(
      "Условието е изпълнено: f = 18,18 mm ≤ l/200 = 20 mm.",
    );
  });

  it("сметките са разписани с числата и с превръщането на единиците", () => {
    const lines = allLines(input);
    expect(lines).toContain("I_x = b·h³ / 12 = 10·20³ / 12 = 6666,67 cm⁴");
    expect(lines).toContain("E·I = 1100·6666,67 = 7 333 333,33 kN·cm²");
    expect(lines).toContain(
      "1 m² = 10 000 cm², затова делим на 10 000: E·I = 733,33 kN·m²",
    );
    expect(lines).toContain("f = 5·q·l⁴ / (384·E·I)");
    expect(lines).toContain("f = 5·4·4⁴ / (384·733,33) = 0,01818 m");
    expect(lines).toContain("f = 0,01818·1000 = 18,18 mm (1,82 cm)");
    expect(lines).toContain("φ = 4·4³ / (24·733,33) = 0,01455 rad");
  });

  it("легнала (20×10): I = 1666,67 cm⁴ → f = 7,27 cm", () => {
    expect(
      result({ ...input, b: 20, h: 10 }, "Най-голямо провисване f")?.note,
    ).toBe("7,27 cm – в средата");
  });
});

describe("останалите примери от учебника", () => {
  it("конзола IPE 200 (I = 1943 cm⁴), l = 2 m, F = 10 kN: f = 0,65 cm; φ = 0,0049 rad = 0,28°", () => {
    const input = preset(1);
    expect(solved(input).EI).toBeCloseTo(4080.3, 9);
    expect(result(input, "Най-голямо провисване f")).toMatchObject({
      value: "6,54 mm",
      note: "0,65 cm – в свободния край",
    });
    expect(result(input, "Ъгъл на завъртане φ")).toMatchObject({
      value: "0,0049 rad",
      note: "0,28° – в свободния край",
    });
    expect(allLines(input)).toContain("I_x = 1943 cm⁴ – зададен направо.");
  });

  it("греда 8×16 cm, l = 3 m, F = 6 kN в средата, E = 1100: f = 1,12 cm", () => {
    const input = preset(2);
    expect(result(input, "I_x")?.value).toBe("2730,67 cm⁴");
    expect(result(input, "Коравина E·I")?.value).toBe("300,37 kN·m²");
    expect(result(input, "Най-голямо провисване f")?.note).toBe(
      "1,12 cm – в средата",
    );
  });

  it("стоманена конзола 4×10 cm, l = 1,5 m, q = 8 kN/m: f = 0,72 cm; φ = 0,00643 rad", () => {
    const input = preset(3);
    expect(result(input, "Коравина E·I")?.value).toBe("700 kN·m²");
    expect(result(input, "Най-голямо провисване f")?.note).toBe(
      "0,72 cm – в свободния край",
    );
    expect(result(input, "Ъгъл на завъртане φ")?.value).toBe("0,00643 rad");
  });

  it("IPE 220 (I = 2771 cm⁴), l = 5 m, q = 12,8 kN/m: f = 1,79 cm; l/250 = 20 mm – изпълнено; l/300 – не", () => {
    const input: DeflectionInput = {
      ...preset(0),
      l: 5,
      load: 12.8,
      E: 21000,
      inertiaFrom: "value",
      I: 2771,
    };
    expect(flexuralRigidity(21000, 2771)).toBeCloseTo(5819.1, 9);
    expect(result(input, "Най-голямо провисване f")?.note).toBe(
      "1,79 cm – в средата",
    );
    expect(solved(input).withinLimit).toBe(true);
    expect(solved({ ...input, limit: 300 }).withinLimit).toBe(false);
  });
});

describe("надписи и невалидни данни", () => {
  it("l/f се закръгля до цяло; без товар няма провисване", () => {
    expect(spanRatioLabel(219.99)).toBe("l/220");
    expect(spanRatioLabel(1e7)).toBe("под l/100 000");
    expect(spanRatioLabel(null)).toBe("няма провисване");
    const solution = solved({ ...preset(0), load: 0 });
    expect(solution.fMm).toBe(0);
    expect(solution.ratio).toBeNull();
    expect(solution.withinLimit).toBe(true);
    expect(JSON.stringify(solution.results)).not.toMatch(/NaN|Infinity/);
    expect(JSON.stringify(solution.steps)).not.toMatch(/NaN|Infinity/);
  });

  it("всяка схема има формула и надпис", () => {
    expect(deflectionSchemes.map((scheme) => scheme.id)).toEqual([
      "cantilever-force",
      "cantilever-distributed",
      "simple-force-mid",
      "simple-distributed",
    ]);
  });

  it("невалидни стойности дават съобщение, а не грешка", () => {
    for (const patch of [
      { l: 0 },
      { E: -5 },
      { b: 0 },
      { limit: 0 },
      { load: -3 },
      { h: NaN },
      { l: Infinity },
    ]) {
      const solution = solveDeflection({ ...preset(0), ...patch });
      expect(solution.ok).toBe(false);
      if (!solution.ok) expect(solution.problem.length).toBeGreaterThan(10);
    }
  });
});
