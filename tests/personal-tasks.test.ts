import { describe, expect, it } from "vitest";
import {
  TASK_LIST,
  buildTask,
  checkAnswers,
  isClose,
  variantFromFacultyNumber,
  type Variant,
} from "@/lib/personal-tasks";

const v147: Variant = { a: 1, b: 4, c: 7 };
const answers = (slug: string, variant = v147) =>
  buildTask(slug, variant)!.answers;

describe("вариант от факултетния номер", () => {
  it("взема последните три цифри и пренебрегва всичко, което не е цифра", () => {
    expect(variantFromFacultyNumber("23147")).toEqual(v147);
    expect(variantFromFacultyNumber(" 23-147 ")).toEqual(v147);
    expect(variantFromFacultyNumber("Ф 20 23 147")).toEqual(v147);
    expect(variantFromFacultyNumber("9000")).toEqual({ a: 0, b: 0, c: 0 });
  });

  it("отказва твърде къси и твърде дълги номера", () => {
    expect(variantFromFacultyNumber("")).toBeNull();
    expect(variantFromFacultyNumber("147")).toBeNull();
    expect(variantFromFacultyNumber("абв")).toBeNull();
    expect(variantFromFacultyNumber("1234567890123")).toBeNull();
  });
});

// Очакваните стойности са сметнати на ръка за вариант 1-4-7.
describe("верни отговори за вариант 1-4-7", () => {
  it("проста греда: l = 6,5 m, q = 11 kN/m, F = 28 kN на 2 m", () => {
    // A = 11·6,5/2 + 28·4,5/6,5 = 35,75 + 19,385 = 55,135
    // B = 35,75 + 28·2/6,5 = 44,365;  A + B = 99,5 = 11·6,5 + 28
    // M(2) = 55,135·2 − 11·2·1 = 88,269
    // Q вдясно от силата: 55,135 − 22 − 28 = 5,135 → нула на 2 + 5,135/11 = 2,467 m
    // M_max = 88,269 + 5,135²/(2·11) = 89,468
    const result = answers("prosta-greda");
    expect(result.A).toBeCloseTo(55.1346, 3);
    expect(result.B).toBeCloseTo(44.3654, 3);
    expect(result.A! + result.B!).toBeCloseTo(99.5, 9);
    expect(result.MF).toBeCloseTo(88.2692, 3);
    expect(result.Mmax).toBeCloseTo(89.4676, 3);
  });

  it("конзола: l = 3,2 m, q = 12 kN/m, F = 14 kN", () => {
    // A = 12·3,2 + 14 = 52,4;  M_A = 12·3,2²/2 + 14·3,2 = 106,24
    // Q(1,6) = 14 + 12·1,6 = 33,2;  M(1,6) = 14·1,6 + 12·1,6·0,8 = 37,76
    const result = answers("konzola");
    expect(result.A).toBeCloseTo(52.4, 9);
    expect(result.MA).toBeCloseTo(106.24, 9);
    expect(result.Qmid).toBeCloseTo(33.2, 9);
    expect(result.Mmid).toBeCloseTo(37.76, 9);
  });

  it("сечение „Т“: пояс 11×3 cm, стебло 2×14 cm", () => {
    // A = 28 + 33 = 61;  y_c = (28·7 + 33·15,5)/61 = 707,5/61 = 11,598
    // I_x = 2·14³/12 + 28·4,598² + 11·3³/12 + 33·3,902² = 1576,5
    // I_y = 14·2³/12 + 3·11³/12 = 9,333 + 332,75 = 342,083
    const result = answers("t-sechenie");
    expect(result.A).toBeCloseTo(61, 9);
    expect(result.yc).toBeCloseTo(707.5 / 61, 9);
    expect(result.Ix).toBeCloseTo(
      (2 * 14 ** 3) / 12 +
        28 * (707.5 / 61 - 7) ** 2 +
        (11 * 27) / 12 +
        33 * (15.5 - 707.5 / 61) ** 2,
      6,
    );
    expect(result.Ix!.toFixed(1)).toBe("1576.5");
    expect(result.Iy).toBeCloseTo(342.0833, 3);
  });

  it("стъпаловиден прът: A₁ = 7, A₂ = 4 cm², F₁ = 28, F₂ = 17 kN", () => {
    // N₁ = 45;  σ₁ = 45/7 = 6,429 kN/cm² = 64,29 MPa;  σ₂ = 17/4 = 42,5 MPa
    // Δl = 45·120/(21000·7) + 17·80/(21000·4) = 0,03673 + 0,01619 cm = 0,529 mm
    const result = answers("stapalovidan-prat");
    expect(result.N1).toBeCloseTo(45, 9);
    expect(result.s1).toBeCloseTo(450 / 7, 9);
    expect(result.s2).toBeCloseTo(42.5, 9);
    expect(result.dl!.toFixed(3)).toBe("0.529");
  });

  it("огъване: l = 4,2 m, q = 6,5 kN/m, сечение 10×26 cm", () => {
    // M = 6,5·4,2²/8 = 14,3325;  W = 10·26²/6 = 1126,67
    // σ_max = 1433,25/1126,67 = 1,2721 kN/cm² = 12,72 MPa
    // I = 10·26³/12 = 14646,67;  σ(5) = 1433,25·5/14646,67 = 0,4893 kN/cm² = 4,89 MPa
    const result = answers("ogavane");
    expect(result.Mmax).toBeCloseTo(14.3325, 9);
    expect(result.W).toBeCloseTo(1126.6667, 3);
    expect(result.smax!.toFixed(2)).toBe("12.72");
    expect(result.s5!.toFixed(2)).toBe("4.89");
  });
});

describe("всички 1000 варианта", () => {
  const variants: Variant[] = [];
  for (let a = 0; a < 10; a++)
    for (let b = 0; b < 10; b++)
      for (let c = 0; c < 10; c++) variants.push({ a, b, c });

  it("всяка задача се построява и има краен положителен отговор на всеки въпрос", () => {
    for (const { slug } of TASK_LIST) {
      for (const variant of variants) {
        const task = buildTask(slug, variant)!;
        expect(task.questions.length).toBe(4);
        for (const question of task.questions) {
          const value = task.answers[question.id]!;
          expect(Number.isFinite(value), `${slug} ${question.id}`).toBe(true);
          expect(value, `${slug} ${question.id}`).toBeGreaterThan(0);
        }
        expect(Object.keys(task.answers).sort()).toEqual(
          task.questions.map((question) => question.id).sort(),
        );
      }
    }
  });

  it("проста греда: силата е вътре в отвора и реакциите уравновесяват товара", () => {
    for (const variant of variants) {
      const task = buildTask("prosta-greda", variant)!;
      const value = (symbol: string) =>
        task.given.find((item) => item.symbol === symbol)!.value;
      expect(value("l")).toBeGreaterThan(2);
      expect(task.answers.A! + task.answers.B!).toBeCloseTo(
        value("q") * value("l") + value("F"),
        9,
      );
      expect(task.answers.Mmax!).toBeGreaterThanOrEqual(
        task.answers.MF! - 1e-9,
      );
    }
  });

  it("огъване: сечението е по-високо, отколкото широко, и влакното на 5 cm е вътре в него", () => {
    for (const variant of variants) {
      const task = buildTask("ogavane", variant)!;
      const value = (symbol: string) =>
        task.given.find((item) => item.symbol === symbol)!.value;
      expect(value("h")).toBeGreaterThan(value("b"));
      expect(value("h") / 2).toBeGreaterThan(5);
      expect(task.answers.s5!).toBeLessThan(task.answers.smax!);
    }
  });

  it("стъпаловиден прът: напреженията са под границата на провлачане 235 MPa", () => {
    for (const variant of variants) {
      const task = buildTask("stapalovidan-prat", variant)!;
      expect(task.answers.s1!).toBeLessThan(235);
      expect(task.answers.s2!).toBeLessThan(235);
    }
  });

  it("различните варианти дават различни числа", () => {
    for (const { slug } of TASK_LIST) {
      const seen = new Set(
        variants.map((variant) =>
          JSON.stringify(buildTask(slug, variant)!.given),
        ),
      );
      expect(seen.size, slug).toBeGreaterThanOrEqual(90);
    }
  });
});

describe("проверка на отговорите", () => {
  it("допуск 0,5 % от верния отговор", () => {
    expect(isClose(100, 100.5)).toBe(true);
    expect(isClose(100, 99.5)).toBe(true);
    expect(isClose(100, 100.51)).toBe(false);
    expect(isClose(100, 99.49)).toBe(false);
    expect(isClose(100, -100)).toBe(false);
  });

  it("при малки стойности закръглянето до втория знак не се наказва", () => {
    expect(isClose(0.5292, 0.53)).toBe(true);
    expect(isClose(0.5292, 0.52)).toBe(false);
    expect(isClose(0.5292, Number.NaN)).toBe(false);
  });

  it("връща кой отговор е верен; липсващият е грешен", () => {
    const task = buildTask("konzola", v147)!;
    expect(
      checkAnswers(task, { A: 52.4, MA: 106.2, Qmid: 30, Mmid: null }),
    ).toEqual({ A: true, MA: true, Qmid: false, Mmid: false });
  });

  it("непозната задача или невалиден вариант не се построяват", () => {
    expect(buildTask("няма-такава", v147)).toBeNull();
    expect(buildTask("konzola", { a: 10, b: 0, c: 0 })).toBeNull();
    expect(buildTask("konzola", { a: 1.5, b: 0, c: 0 })).toBeNull();
  });
});
