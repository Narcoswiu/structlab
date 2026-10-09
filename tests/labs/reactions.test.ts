import { describe, expect, it } from "vitest";
import {
  defaultReactionLoad,
  inclinedAngleDeg,
  reactionLoadKinds,
  reactionsPresets,
  solveReactions,
  type ReactionLoad,
  type ReactionsInput,
} from "@/lib/labs/reactions";

// Очакваните числа са от tests/engineering/plane-body.test.ts – там сметката
// на ръка стои в коментара над всеки тест (примерите от Глава 3).

const preset = (label: string): ReactionsInput =>
  reactionsPresets.find((item) => item.label === label)!.input;

function solved(input: ReactionsInput) {
  const solution = solveReactions(input);
  if (!solution.ok) throw new Error(solution.problem);
  return solution;
}

const result = (input: ReactionsInput, name: string) =>
  solved(input).results.find((item) => item.name === name);

const lines = (input: ReactionsInput) =>
  solved(input).steps.flatMap((step) => step.lines);

const simple = (l: number, loads: ReactionLoad[], xB = l): ReactionsInput => ({
  scheme: "pin-roller",
  l,
  xA: 0,
  xB,
  loads,
});

describe("греда 8 m с конзолен край (пример П1)", () => {
  const input = preset("Греда 8 m с конзолен край");

  it("A_h = 10; B_v = 198,56/6 = 33,09; A_v = 24 + 17,32 − 33,09 = 8,23 kN", () => {
    const solution = solved(input);
    expect(solution.Ah).toBeCloseTo(10, 9);
    expect(solution.Bv).toBeCloseTo(33.094, 3);
    expect(solution.Av).toBeCloseTo(8.2265, 3);
    expect(solution.MA).toBeNull();
    expect(result(input, "A_h")).toMatchObject({
      value: "10 kN",
      note: "надясно",
    });
    expect(result(input, "B_v")?.value).toBe("33,09 kN");
    expect(result(input, "A_v")?.value).toBe("8,23 kN");
  });

  it("проверката ΣM_B излиза нула", () => {
    const solution = solved(input);
    expect(solution.balanced).toBe(true);
    expect(solution.check).toEqual({ point: "B", x: 6, moment: 0 });
    expect(solution.verdict).toBe(
      "Проверката излиза: ΣM_B = 0 – гредата е в равновесие.",
    );
    expect(result(input, "Проверка ΣM_B")?.value).toBe("0 kN·m");
  });

  it("сметките са в реда на решаване и с числата", () => {
    const solution = solved(input);
    expect(solution.steps.map((step) => step.title)).toEqual([
      "Приети посоки и знаци",
      "Равнодействащи на разпределените товари",
      "Проекции на наклонените сили",
      "Проекции по x: хоризонталната реакция в A",
      "Моменти спрямо A: реакцията в B",
      "Проекции по y: вертикалната реакция в A",
      "Проверка: моменти спрямо B",
    ]);
    const all = lines(input);
    expect(all).toContain("R_q = q·a = 6·4 = 24 kN");
    expect(all).toContain(
      "R_q действа в средата на участъка: x = 0 + 4 / 2 = 2 m.",
    );
    expect(all).toContain("F_x = F·cos α = 20·cos 60° = 10 kN (наляво)");
    expect(all).toContain("F_y = F·sin α = 20·sin 60° = 17,32 kN (надолу)");
    expect(all).toContain("ΣF_x = A_h − 10 = 0");
    expect(all).toContain("ΣM_A = B_v·6 − 24·2 − 12 − 17,32·8 = 0");
    expect(all).toContain("B_v = 198,56 / 6 = 33,09 kN");
    expect(all).toContain("ΣF_y = A_v + 33,09 − 24 − 17,32 = 0");
    expect(all).toContain("ΣM_B = −8,23·6 + 24·4 − 12 − 17,32·2 = 0");
  });
});

describe("останалите примери от главата", () => {
  it("Л1 – проста греда 5 m, 20 kN на 2 m: B_v = 8; A_v = 12; A_h = 0", () => {
    const input = preset("Проста греда, сила 20 kN");
    expect(result(input, "B_v")?.value).toBe("8 kN");
    expect(result(input, "A_v")?.value).toBe("12 kN");
    expect(result(input, "A_h")).toMatchObject({
      value: "0 kN",
      note: "няма хоризонтален товар",
    });
    expect(lines(input)).toContain("ΣM_A = B_v·5 − 20·2 = 0");
    expect(lines(input)).toContain("B_v = 40 / 5 = 8 kN");
    expect(lines(input)).toContain("ΣM_B = −12·5 + 20·3 = 0");
  });

  it("Л2 = П2 – конзола 3 m, q = 5 и сила 8 kN: A_v = 23 kN; M_A = 46,5 kN·m", () => {
    const input = preset("Конзола: q и сила");
    const solution = solved(input);
    expect(solution.Av).toBeCloseTo(23, 9);
    expect(solution.MA).toBeCloseTo(46.5, 9);
    expect(solution.Bv).toBeNull();
    expect(result(input, "M_A")).toMatchObject({
      value: "46,5 kN·m",
      note: "обратно на часовниковата стрелка",
    });
    expect(result(input, "B_v")).toBeUndefined();
    const all = lines(input);
    expect(all).toContain("R_q = q·a = 5·3 = 15 kN");
    expect(all).toContain("ΣF_y = A_v − 15 − 8 = 0");
    expect(all).toContain("ΣM_A = M_A − 15·1,5 − 8·3 = 0");
    // проверката от теста: 46,5 − 23·3 + 15·1,5 = 0
    expect(all).toContain("ΣM_K = 46,5 − 23·3 + 15·1,5 = 0");
    expect(solution.check.point).toBe("K");
  });

  it("П4 – сила 30 kN под 45°: B_v = 7,07; A_v = 14,14; A_h = −21,21 kN (наляво)", () => {
    const input = preset("Сила 30 kN под 45°");
    expect(result(input, "B_v")?.value).toBe("7,07 kN");
    expect(result(input, "A_v")?.value).toBe("14,14 kN");
    expect(result(input, "A_h")).toMatchObject({
      value: "−21,21 kN",
      note: "наляво – обратно на приетата посока",
    });
    expect(lines(input)).toContain(
      "A_h е с минус: действа обратно на приетата посока.",
    );
  });

  it("триъгълен товар 0 → 9 kN/m върху 6 m: R_q = 27 kN при x = 4 m; B_v = 18; A_v = 9", () => {
    const input = preset("Триъгълен товар 0 → 9 kN/m");
    expect(result(input, "B_v")?.value).toBe("18 kN");
    expect(result(input, "A_v")?.value).toBe("9 kN");
    expect(lines(input)).toContain("R_q = q·a / 2 = 9·6 / 2 = 27 kN");
    expect(lines(input)).toContain(
      "R_q е на 2/3 от нулевия край: x = 0 + 2/3·6 = 4 m.",
    );
  });

  it("всеки пример излиза в равновесие и без NaN", () => {
    for (const item of reactionsPresets) {
      const solution = solved(item.input);
      expect(solution.balanced, item.label).toBe(true);
      expect(JSON.stringify(solution)).not.toMatch(/NaN|Infinity|null,null/);
    }
  });
});

describe("още случаи с проверени на ръка числа", () => {
  it("тераса с конзола: опори 0 и 4,8 m, q = 12 върху 6 m → B_v = 45; A_v = 27", () => {
    const input = simple(6, [{ kind: "uniform", q: 12, from: 0, to: 6 }], 4.8);
    expect(result(input, "B_v")?.value).toBe("45 kN");
    expect(result(input, "A_v")?.value).toBe("27 kN");
    // −27·4,8 + 72·1,8 = 0
    expect(lines(input)).toContain("ΣM_B = −27·4,8 + 72·1,8 = 0");
  });

  it("опори 0 и 4 m, сила 10 kN при 6 m → B_v = 15; A_v = −5 kN (надолу)", () => {
    const input = simple(6, [{ kind: "vertical", F: 10, x: 6 }], 4);
    expect(result(input, "B_v")?.value).toBe("15 kN");
    expect(result(input, "A_v")).toMatchObject({
      value: "−5 kN",
      note: "надолу – обратно на приетата посока",
    });
  });

  it("q = 4 върху 6 m и момент 12 kN·m по часовниковата → B_v = 14; A_v = 10", () => {
    const input = simple(6, [
      { kind: "uniform", q: 4, from: 0, to: 6 },
      { kind: "couple", M: -12, x: 3 },
    ]);
    expect(result(input, "B_v")?.value).toBe("14 kN");
    expect(result(input, "A_v")?.value).toBe("10 kN");
    expect(lines(input)).toContain("ΣM_A = B_v·6 − 24·3 − 12 = 0");
  });

  it("40 kN под 30°, надолу и надясно, при 2 m от 5 m → B_v = 8; A_v = 12; A_h = −34,64", () => {
    const input = simple(5, [
      { kind: "inclined", F: 40, angle: 30, direction: "down-right", x: 2 },
    ]);
    expect(result(input, "B_v")?.value).toBe("8 kN");
    expect(result(input, "A_v")?.value).toBe("12 kN");
    expect(result(input, "A_h")?.value).toBe("−34,64 kN");
  });

  it("конзола 2 m, сила 5 kN в края → A_v = 5 kN; M_A = 10 kN·m", () => {
    const input: ReactionsInput = {
      scheme: "fixed",
      l: 2,
      xA: 0,
      xB: 2,
      loads: [{ kind: "vertical", F: 5, x: 2 }],
    };
    expect(result(input, "A_v")?.value).toBe("5 kN");
    expect(result(input, "M_A")?.value).toBe("10 kN·m");
  });

  it("опора B вляво от A: знаците в уравнението се обръщат, резултатът е същият", () => {
    // A при 5, B при 0, сила 20 kN на 2 m: B_v = 20·3/5 = 12; A_v = 8
    const input: ReactionsInput = {
      scheme: "pin-roller",
      l: 5,
      xA: 5,
      xB: 0,
      loads: [{ kind: "vertical", F: 20, x: 2 }],
    };
    expect(result(input, "B_v")?.value).toBe("12 kN");
    expect(result(input, "A_v")?.value).toBe("8 kN");
    expect(lines(input)).toContain("ΣM_A = −B_v·5 + 20·3 = 0");
    expect(lines(input)).toContain("B_v = −60 / (−5) = 12 kN");
  });

  it("няколко товара от един вид се номерират", () => {
    const input = simple(6, [
      { kind: "vertical", F: 10, x: 2 },
      { kind: "inclined", F: 10, angle: 90, direction: "up-right", x: 4 },
      { kind: "uniform", q: 2, from: 0, to: 3 },
      { kind: "triangular", q: 6, zeroAt: 6, peakAt: 3 },
    ]);
    const all = lines(input);
    expect(all).toContain("R_q1 = q·a = 2·3 = 6 kN");
    // нулата е при 6 m, върхът при 3 m: x = 6 − 2/3·3 = 4 m
    expect(all).toContain(
      "R_q2 е на 2/3 от нулевия край: x = 6 − 2/3·3 = 4 m.",
    );
    expect(all).toContain("F_2y = F_2·sin α = 10·sin 90° = 10 kN (нагоре)");
    // ΣF_y: 10 надолу, 10 нагоре, 6 и 9 надолу → A_v + B_v = 15
    const solution = solved(input);
    expect(solution.Av + solution.Bv!).toBeCloseTo(15, 9);
    expect(solution.Ah).toBe(0);
  });

  it("без товари всички реакции са нула", () => {
    const input = simple(4, []);
    expect(result(input, "A_v")).toMatchObject({
      value: "0 kN",
      note: "опората не е натоварена",
    });
    expect(lines(input)).toContain("ΣM_A = B_v·4 = 0");
  });
});

describe("посока на наклонената сила", () => {
  it("ъгълът спрямо оста x е както в plane-body: 60° надолу и наляво = 240°", () => {
    expect(inclinedAngleDeg(60, "down-left")).toBe(240);
    expect(inclinedAngleDeg(45, "down-right")).toBe(-45);
    expect(inclinedAngleDeg(30, "up-right")).toBe(30);
    expect(inclinedAngleDeg(30, "up-left")).toBe(150);
  });
});

describe("невалидни и неустойчиви схеми", () => {
  const problem = (input: ReactionsInput) => {
    const solution = solveReactions(input);
    return solution.ok ? null : solution.problem;
  };
  const force: ReactionLoad = { kind: "vertical", F: 10, x: 2 };

  it("двете опори в една точка", () => {
    expect(problem({ ...simple(6, [force]), xA: 3, xB: 3 })).toBe(
      "Двете опори са в една точка – гредата може да се завърти около нея. Раздалечи опорите A и B.",
    );
  });

  it("опора или товар извън гредата", () => {
    expect(problem(simple(6, [force], 7))).toBe(
      "Опората B е извън гредата (от 0 до 6 m).",
    );
    expect(problem({ ...simple(6, [force]), xA: -1 })).toBe(
      "Опората A е извън гредата (от 0 до 6 m).",
    );
    expect(
      problem(simple(6, [force, { kind: "vertical", F: 5, x: 6.5 }])),
    ).toBe("Товар 2: мястото е извън гредата (от 0 до 6 m).");
    expect(
      problem(simple(4, [{ kind: "uniform", q: 3, from: 1, to: 5 }])),
    ).toBe("Товар 1: мястото е извън гредата (от 0 до 4 m).");
  });

  it("разпределен товар без дължина, отрицателни стойности, грешен ъгъл", () => {
    expect(
      problem(simple(6, [{ kind: "uniform", q: 3, from: 2, to: 2 }])),
    ).toMatch(/трябва да има дължина/);
    expect(
      problem(simple(6, [{ kind: "triangular", q: 3, zeroAt: 2, peakAt: 2 }])),
    ).toMatch(/трябва да има дължина/);
    expect(problem(simple(6, [{ kind: "vertical", F: -1, x: 2 }]))).toMatch(
      /въведи положително число/,
    );
    expect(
      problem(
        simple(6, [
          { kind: "inclined", F: 5, angle: 120, direction: "up-left", x: 2 },
        ]),
      ),
    ).toBe("Товар 1: ъгълът спрямо хоризонталата е от 0 до 90°.");
  });

  it("повече от пет товара и нечислови данни", () => {
    expect(
      problem(
        simple(
          6,
          Array.from({ length: 6 }, () => force),
        ),
      ),
    ).toBe("Най-много 5 товара.");
    expect(problem(simple(Number.NaN, [force]))).toBe(
      "Въведи числа във всички полета.",
    );
    expect(problem(simple(0, [force]))).toBe(
      "Дължината на гредата трябва да е положителна.",
    );
    expect(problem(simple(6, [{ kind: "couple", M: Infinity, x: 2 }]))).toBe(
      "Товар 1: въведи числа.",
    );
  });

  it("при запъване местата на опорите не се проверяват", () => {
    const input: ReactionsInput = {
      scheme: "fixed",
      l: 3,
      xA: 9,
      xB: 9,
      loads: [force],
    };
    expect(solved(input).MA).toBeCloseTo(20, 9);
  });

  it("началните стойности на всеки вид товар дават валидна схема", () => {
    for (const kind of reactionLoadKinds) {
      const solution = solveReactions(
        simple(7, [defaultReactionLoad(kind.id, 7)]),
      );
      expect(solution.ok, kind.label).toBe(true);
    }
  });
});
