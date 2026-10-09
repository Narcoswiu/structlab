import { describe, expect, it } from "vitest";
import { labNumber, labPrecise } from "@/lib/labs/format";
import {
  buildStressSection,
  solveStresses,
  stressPresets,
  type StressInput,
} from "@/lib/labs/stresses";

// Очакваните числа са отпечатаните в учебника (Глави 4 и 5); сметките на ръка
// са в tests/engineering/bending.test.ts и shear.test.ts.

const preset = (index: number): StressInput => stressPresets[index]!.input;

function solved(input: StressInput) {
  const solution = solveStresses(input);
  if (!solution.ok) throw new Error(solution.problem);
  return solution;
}

const value = (input: StressInput, name: string) =>
  solved(input).results.find((item) => item.name === name)?.value;

const allLines = (input: StressInput) =>
  solved(input).steps.flatMap((step) => step.lines);

describe("показване на числа", () => {
  it("десетична запетая, до два знака, без излишни нули", () => {
    expect(labNumber(12.000000000000002)).toBe("12");
    expect(labNumber(0.6)).toBe("0,6");
    expect(labNumber(6666.666)).toBe("6666,67");
    expect(labNumber(-26.28)).toBe("−26,28");
  });

  it("големите числа са на тройки, малките пазят две значещи цифри", () => {
    expect(labNumber(7333333.333)).toBe("7 333 333,33");
    expect(labNumber(21000)).toBe("21 000");
    expect(labNumber(0.0049)).toBe("0,0049");
    expect(labNumber(0.00000001)).toBe("≈ 0");
    expect(labNumber(0)).toBe("0");
  });

  it("никога не връща NaN или безкрайност", () => {
    expect(labNumber(NaN)).toBe("–");
    expect(labNumber(Infinity)).toBe("–");
    expect(labPrecise(NaN)).toBe("–");
  });

  it("малки величини с фиксирани знаци: 0,01818 m; 0,0049 rad; 0,603 kN/cm²", () => {
    expect(labPrecise(0.018181818)).toBe("0,01818");
    expect(labPrecise(0.004901)).toBe("0,0049");
    expect(labPrecise(0.6031, 3)).toBe("0,603");
  });
});

describe("правоъгълник 10×20 cm, M = 8 kN·m, Q = 8 kN (Глави 4 и 5)", () => {
  const input = preset(0);

  it("I_x = 10·20³/12 = 6666,67 cm⁴; W = 666,67 cm³", () => {
    expect(value(input, "I_x")).toBe("6666,67 cm⁴");
    expect(value(input, "W_x горе")).toBe("666,67 cm³");
    expect(value(input, "W_x долу")).toBe("666,67 cm³");
  });

  it("σ = 800/666,67 = 1,2 kN/cm² = 12 MPa – опън долу, натиск горе", () => {
    const solution = solved(input);
    expect(value(input, "σ_max опън")).toBe("12 MPa");
    expect(value(input, "σ_max натиск")).toBe("12 MPa");
    expect(solution.sigmaBottom).toBeCloseTo(12, 9);
    expect(solution.sigmaTop).toBeCloseTo(-12, 9);
    expect(
      solution.results.find((item) => item.name === "σ_max опън")?.note,
    ).toBe("в долното влакно");
  });

  it("τ_max = 1,5·8/200 = 0,06 kN/cm² = 0,6 MPa на неутралната ос", () => {
    const solution = solved(input);
    expect(value(input, "τ_max")).toBe("0,6 MPa");
    expect(solution.tauAtNeutralAxis).toBe(true);
    expect(solution.webShare).toBeNull();
  });

  it("сметките са разписани с числата", () => {
    const lines = allLines(input);
    expect(lines).toContain("I_x = b·h³ / 12 = 10·20³ / 12 = 6666,67 cm⁴");
    expect(lines).toContain("M = 8 kN·m = 800 kN·cm (1 m = 100 cm)");
    expect(lines).toContain(
      "σ_долу = M·y_долу / I_x = 800·10 / 6666,67 = 1,2 kN/cm² = 12 MPa (опън)",
    );
    expect(lines).toContain(
      "σ_горе = −M·y_горе / I_x = −800·10 / 6666,67 = −1,2 kN/cm² = −12 MPa (натиск)",
    );
    // S = 10·10·5 = 500 cm³
    expect(lines).toContain(
      "τ_max = Q·S / (I_x·b) = 8·500 / (6666,67·10) = 0,06 kN/cm² = 0,6 MPa",
    );
  });

  it("отрицателен момент: опънът минава горе; знакът на Q не влияе", () => {
    const solution = solved({ ...input, M: -8, Q: -8 });
    expect(solution.sigmaTop).toBeCloseTo(12, 9);
    expect(solution.sigmaBottom).toBeCloseTo(-12, 9);
    expect(solution.tauMax).toBeCloseTo(0.6, 9);
    expect(
      solution.results.find((item) => item.name === "σ_max опън")?.note,
    ).toBe("в горното влакно");
  });
});

describe("сечение „Т“ 2×10 + 12×2 cm, M = 4 kN·m, Q = 10 kN", () => {
  const input = preset(1);

  it("сечението е същото като в Глава 2: стебло долу, пояс горе", () => {
    expect(buildStressSection(input)).toEqual([
      { b: 2, h: 10, x: 5, y: 0 },
      { b: 12, h: 2, x: 0, y: 10 },
    ]);
  });

  it("y_c = 8,27 cm; I_x = 567,39 cm⁴; W = 152,23 (горе) и 68,59 cm³ (долу)", () => {
    expect(value(input, "Неутрална ос")).toBe("8,27 cm");
    expect(value(input, "I_x")).toBe("567,39 cm⁴");
    expect(value(input, "W_x горе")).toBe("152,23 cm³");
    expect(value(input, "W_x долу")).toBe("68,59 cm³");
  });

  it("σ_долу = 400·8,27/567,39 = 5,83 kN/cm²; σ_горе = −2,63 kN/cm²", () => {
    const solution = solved(input);
    expect((solution.sigmaBottom / 10).toFixed(2)).toBe("5.83");
    expect((solution.sigmaTop / 10).toFixed(2)).toBe("-2.63");
    expect(value(input, "σ_max опън")).toBe("58,32 MPa");
    expect(value(input, "σ_max натиск")).toBe("26,28 MPa");
  });

  it("τ_max = 10·68,44/(567,39·2) = 0,603 kN/cm² = 6,03 MPa; стеблото поема 87 %", () => {
    expect(value(input, "τ_max")).toBe("6,03 MPa");
    expect(value(input, "Дял на Q в стеблото")).toBe("87 %");
    expect(allLines(input)).toContain(
      "τ_max = Q·S / (I_x·b) = 10·68,44 / (567,39·2) = 0,603 kN/cm² = 6,03 MPa",
    );
  });
});

describe("сечение „I“: пояси 10×1,2 cm, стебло 0,8×17,6 cm, Q = 60 kN", () => {
  const input = preset(2);

  it("I_x = 2486,97 cm⁴; τ_max = 4,34 kN/cm² = 43,36 MPa; стеблото поема 94 %", () => {
    expect(value(input, "I_x")).toBe("2486,97 cm⁴");
    expect(value(input, "τ_max")).toBe("43,36 MPa");
    expect(value(input, "Дял на Q в стеблото")).toBe("94 %");
    // S = 12·9,4 + 0,8·8,8·4,4 = 143,78 cm³
    expect(allLines(input).join("\n")).toContain(
      "S = 7,04·4,4 + 12·9,4 = 143,78 cm³",
    );
  });

  it("M = 40 kN·m: W = 2486,97/10 = 248,7 cm³; σ = 4000/248,7 = 16,08 kN/cm²", () => {
    expect(value(input, "W_x долу")).toBe("248,7 cm³");
    expect(value(input, "σ_max опън")).toBe("160,84 MPa");
  });
});

describe("невалидни и гранични данни", () => {
  const input = preset(1);

  it("стебло, по-широко от пояса, се отказва с ясно съобщение", () => {
    expect(solveStresses({ ...input, tw: 12 })).toEqual({
      ok: false,
      problem: "Стеблото трябва да е по-тясно от пояса.",
    });
  });

  it("нулеви, отрицателни и нечислови стойности не чупят нищо", () => {
    for (const patch of [
      { bf: 0 },
      { hw: -1 },
      { M: NaN },
      { Q: Infinity },
      { tf: NaN },
    ]) {
      const solution = solveStresses({ ...input, ...patch });
      expect(solution.ok).toBe(false);
    }
  });

  it("M = 0 и Q = 0: нули, без NaN", () => {
    const solution = solved({ ...input, M: 0, Q: 0 });
    const text = JSON.stringify(solution);
    expect(solution.maxTension).toBe(0);
    expect(solution.tauMax).toBe(0);
    expect(text).not.toMatch(/NaN|Infinity|null,"steps"/);
    expect(solution.results.find((item) => item.name === "τ_max")?.note).toBe(
      "няма напречна сила",
    );
  });

  it("крайни размери от допустимите граници дават крайни числа", () => {
    for (const patch of [
      { bf: 500, tf: 0.1, tw: 0.1, hw: 500 },
      { bf: 0.2, tf: 500, tw: 0.1, hw: 0.1 },
    ]) {
      for (const kind of ["tee", "ibeam"] as const) {
        const solution = solved({ ...input, ...patch, kind, M: 1e4, Q: 1e4 });
        for (const item of solution.results) {
          expect(item.value).not.toMatch(/NaN|Infinity|–/);
        }
      }
    }
  });
});
