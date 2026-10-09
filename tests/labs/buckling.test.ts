import { describe, expect, it } from "vitest";
import {
  bucklingPresets,
  bucklingSupports,
  solveBuckling,
  type BucklingInput,
} from "@/lib/labs/buckling";

// Очакваните числа са отпечатаните в Глава 10; сметките на ръка са в
// tests/engineering/buckling.test.ts. Стомана: π²·E = 207 261,7 kN/cm².

const preset = (index: number): BucklingInput => bucklingPresets[index]!.input;

function solved(input: BucklingInput) {
  const solution = solveBuckling(input);
  if (!solution.ok) throw new Error(solution.problem);
  return solution;
}

const value = (input: BucklingInput, name: string) =>
  solved(input).results.find((item) => item.name === name)?.value;

const allLines = (input: BucklingInput) =>
  solved(input).steps.flatMap((step) => step.lines);

describe("стоманен прът d = 4 cm, l = 1,5 m, шарнир–шарнир", () => {
  const input = preset(0);

  it("I = π·256/64 = 12,57 cm⁴; i = d/4 = 1 cm; λ = 150", () => {
    expect(value(input, "I_min")).toBe("12,57 cm⁴");
    expect(value(input, "i_min")).toBe("1 cm");
    expect(value(input, "Гъвкавост λ")).toBe("150");
  });

  it("λ_гр = π·√(21000/20) = 101,8 → Ойлер важи", () => {
    const solution = solved(input);
    expect(value(input, "Гранична гъвкавост λ_гр")).toBe("101,8");
    expect(solution.valid).toBe(true);
    expect(solution.verdict).toBe(
      "Формулата на Ойлер е приложима: λ = 150 ≥ λ_гр = 101,8.",
    );
  });

  it("F_cr = 207 261,7·12,566/150² = 115,76 kN; σ_cr = 92,12 MPa", () => {
    expect(value(input, "Критична сила F_cr")).toBe("115,76 kN");
    expect(value(input, "Критично напрежение σ_cr")).toBe("92,12 MPa");
  });

  it("F_доп = 115,76/3 = 38,59 kN при n = 3", () => {
    expect(value(input, "Допустима сила F_доп")).toBe("38,59 kN");
    expect(value({ ...input, safety: 2 }, "Допустима сила F_доп")).toBe(
      "57,88 kN",
    );
  });

  it("сметките са разписани с числата", () => {
    const lines = allLines(input);
    expect(lines).toContain("I = π·d⁴ / 64 = π·4⁴ / 64 = 12,57 cm⁴");
    expect(lines).toContain("λ = μ·l / i_min = 150 / 1 = 150");
    expect(lines).toContain("λ_гр = π·√(E / σ_p) = π·√(21 000 / 20) = 101,8");
    expect(lines).toContain(
      "F_cr = π²·E·I_min / (μ·l)² = 207 261,69·12,57 / 150² = 115,76 kN",
    );
    expect(lines).toContain(
      "σ_cr = F_cr / A = 115,76 / 12,57 = 9,212 kN/cm² = 92,12 MPa",
    );
  });
});

describe("същият прът при четирите подпирания (пример 2), σ_p = 200 MPa", () => {
  // [подпиране, λ, F_cr kN, σ_cr MPa] – F_cr = 115,757/μ²
  const rows = [
    ["fixed-free", "300", "28,94 kN", "23,03 MPa"],
    ["pinned-pinned", "150", "115,76 kN", "92,12 MPa"],
    ["fixed-pinned", "105", "236,24 kN", "187,99 MPa"],
  ] as const;

  it.each(rows)(
    "%s: λ = %s, F_cr = %s, σ_cr = %s",
    (support, lambda, F, sigma) => {
      const input = { ...preset(0), support };
      expect(value(input, "Гъвкавост λ")).toBe(lambda);
      expect(value(input, "Критична сила F_cr")).toBe(F);
      expect(value(input, "Критично напрежение σ_cr")).toBe(sigma);
      expect(solved(input).valid).toBe(true);
    },
  );

  it("запъване–запъване: λ = 75 < 101,8 → Ойлер НЕ важи и F_cr не се показва като резултат", () => {
    const input = preset(1);
    const solution = solved(input);
    expect(solution.valid).toBe(false);
    expect(solution.lambda).toBeCloseTo(75, 9);
    expect(solution.allowable).toBeNull();
    expect(solution.verdict).toContain(
      "Формулата на Ойлер НЕ е приложима: λ = 75 < λ_гр = 101,8.",
    );
    expect(value(input, "Критична сила F_cr")).toBe("не се определя по Ойлер");
    expect(value(input, "Критично напрежение σ_cr")).toBe(
      "не се определя по Ойлер",
    );
    expect(value(input, "Допустима сила F_доп")).toBeUndefined();
    // формалното число 463,03 kN не се появява никъде като стойност
    expect(JSON.stringify(solution.results)).not.toContain("463");
    // обяснението показва защо: 207 261,7/75² = 36,847 kN/cm² = 368,47 MPa > 200
    expect(allLines(input).join("\n")).toContain(
      "368,47 MPa. Това е над σ_p = 200 MPa.",
    );
  });

  it("около границата: σ_cr малко под σ_p – важи; малко над σ_p – не важи", () => {
    // i = 1 cm, μ = 1 → λ = 150; σ_cr = π²·21000·10/150² = 92,12 MPa
    const sigmaCr = (Math.PI ** 2 * 21000 * 10) / 150 ** 2;
    expect(solved({ ...preset(0), sigmaP: sigmaCr + 1e-6 }).valid).toBe(true);
    expect(solved({ ...preset(0), sigmaP: sigmaCr - 1e-6 }).valid).toBe(false);
  });
});

describe("останалите примери от учебника", () => {
  it("тръба 10/8 cm, l = 4 m: I = 289,81 cm⁴; A = 28,27 cm²; λ = 124,9; F_cr = 375,4 kN; σ_cr = 132,8 MPa", () => {
    const input = preset(2);
    expect(value(input, "I_min")).toBe("289,81 cm⁴");
    expect(solved(input).A).toBeCloseTo(28.274, 3);
    expect(value(input, "Гъвкавост λ")).toBe("124,9");
    expect(value(input, "Критична сила F_cr")).toBe("375,42 kN");
    expect(value(input, "Критично напрежение σ_cr")).toBe("132,78 MPa");
  });

  it("плътен прът d = 6 cm, l = 4 m: λ = 266,7; F_cr = 82,4 kN; σ_cr = 29,1 MPa", () => {
    const input: BucklingInput = { ...preset(0), l: 4, D: 6 };
    expect(value(input, "Гъвкавост λ")).toBe("266,7");
    expect(value(input, "Критична сила F_cr")).toBe("82,41 kN");
    expect(value(input, "Критично напрежение σ_cr")).toBe("29,15 MPa");
  });

  it("шина 3×6 cm, l = 2 m, μ = 0,7: I_min = 6·27/12 = 13,5 cm⁴; λ = 161,7; F_cr = 142,8 kN", () => {
    const input = preset(3);
    const solution = solved(input);
    expect(value(input, "I_min")).toBe("13,5 cm⁴");
    expect(solution.axis).toBe(
      "около оста y, успоредна на страната h (по-слабата)",
    );
    expect(value(input, "Гъвкавост λ")).toBe("161,7");
    expect(value(input, "Критична сила F_cr")).toBe("142,76 kN");
    expect(allLines(input)).toContain("I_min = 6·3³ / 12 = 13,5 cm⁴");
    // завъртяна на 90° – същият прът, слабата ос вече е x
    const turned = solved({ ...input, b: 6, h: 3 });
    expect(turned.Imin).toBeCloseTo(13.5, 9);
    expect(turned.axis).toBe(
      "около оста x, успоредна на страната b (по-слабата)",
    );
  });

  it("дървен стълб 10×10 cm, l = 4 m, E = 1100: F_cr = 56,5 kN; λ = 138,6; двете оси са равностойни", () => {
    const input: BucklingInput = {
      ...preset(0),
      section: "rect",
      b: 10,
      h: 10,
      l: 4,
      E: 1100,
      sigmaP: 10,
    };
    const solution = solved(input);
    expect(solution.FcrFormula.toFixed(1)).toBe("56.5");
    expect(value(input, "Гъвкавост λ")).toBe("138,6");
    expect(solution.axis).toBe("двете главни оси са равностойни");
  });
});

describe("подпирания и невалидни данни", () => {
  it("четирите класически случая са подредени по μ: 2; 1; 0,7; 0,5", () => {
    expect(
      bucklingSupports.map(
        (support) => solved({ ...preset(0), support: support.id }).mu,
      ),
    ).toEqual([2, 1, 0.7, 0.5]);
  });

  it("невалидни стойности дават съобщение, а не грешка", () => {
    const tube = preset(2);
    expect(solveBuckling({ ...tube, d: 10 })).toEqual({
      ok: false,
      problem: "Вътрешният диаметър трябва да е по-малък от външния.",
    });
    for (const patch of [
      { l: 0 },
      { D: -1 },
      { E: 0 },
      { sigmaP: 0 },
      { safety: 0.5 },
      { l: NaN },
      { E: Infinity },
    ]) {
      expect(solveBuckling({ ...tube, ...patch }).ok).toBe(false);
    }
  });

  it("крайни стойности от допустимите граници не дават NaN или безкрайност", () => {
    for (const patch of [
      { l: 0.01, D: 500, d: 0.1 },
      { l: 100, D: 0.2, d: 0.1 },
      { E: 100000, sigmaP: 1 },
      { E: 1, sigmaP: 2000 },
    ]) {
      const solution = solved({ ...preset(2), ...patch });
      expect(JSON.stringify(solution.results)).not.toMatch(/NaN|Infinity|–"/);
    }
  });
});
